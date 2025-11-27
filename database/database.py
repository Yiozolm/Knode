import sqlite3
import uuid
import os
from datetime import datetime
from typing import List, Dict, Optional
from dataclasses import dataclass

@dataclass
class ConversationNode:
    id: str
    parent_id: Optional[str]
    conversation_id: str
    node_type: str  # 'question' or 'answer'
    content: str
    tokens_input: Optional[int] = None
    tokens_output: Optional[int] = None
    created_at: str = None

    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now().isoformat()

@dataclass
class Conversation:
    id: str
    title: str
    system_msg: str
    model_id: str
    created_at: str
    updated_at: str

    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now().isoformat()
        if self.updated_at is None:
            self.updated_at = datetime.now().isoformat()

class DatabaseManager:
    def __init__(self, db_path: str = os.path.join(os.path.dirname(__file__), "knode.db")):
        self.db_path = db_path
        self.init_database()

    def init_database(self):
        """初始化数据库表结构"""
        with sqlite3.connect(self.db_path) as conn:
            # 启用外键约束
            cursor = conn.cursor()
            cursor.execute('PRAGMA foreign_keys = ON')

            # 对话表
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS conversations (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    system_msg TEXT NOT NULL,
                    model_id TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
            ''')

            # 对话节点表
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS conversation_nodes (
                    id TEXT PRIMARY KEY,
                    parent_id TEXT,
                    conversation_id TEXT NOT NULL,
                    node_type TEXT NOT NULL CHECK (node_type IN ('question', 'answer')),
                    content TEXT NOT NULL,
                    tokens_input INTEGER,
                    tokens_output INTEGER,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (parent_id) REFERENCES conversation_nodes (id),
                    FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE
                )
            ''')

            # 创建索引
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_nodes_conversation
                ON conversation_nodes (conversation_id)
            ''')
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_nodes_parent
                ON conversation_nodes (parent_id)
            ''')
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_nodes_type
                ON conversation_nodes (node_type)
            ''')

            conn.commit()

    def create_conversation(self, title: str, system_msg: str, model_id: str) -> str:
        """创建新对话"""
        conversation_id = str(uuid.uuid4())
        now = datetime.now().isoformat()

        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO conversations (id, title, system_msg, model_id, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (conversation_id, title, system_msg, model_id, now, now))
            conn.commit()

        return conversation_id

    def save_node(self, node: ConversationNode) -> None:
        """保存对话节点"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT OR REPLACE INTO conversation_nodes
                (id, parent_id, conversation_id, node_type, content, tokens_input, tokens_output, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                node.id, node.parent_id, node.conversation_id, node.node_type,
                node.content, node.tokens_input, node.tokens_output, node.created_at
            ))
            conn.commit()

            # 更新对话的最后更新时间
            cursor.execute('''
                UPDATE conversations SET updated_at = ? WHERE id = ?
            ''', (datetime.now().isoformat(), node.conversation_id))

    def get_conversations(self, limit: int = 50) -> List[Conversation]:
        """获取对话列表"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT id, title, system_msg, model_id, created_at, updated_at
                FROM conversations
                ORDER BY updated_at DESC
                LIMIT ?
            ''', (limit,))

            rows = cursor.fetchall()
            return [
                Conversation(
                    id=row[0], title=row[1], system_msg=row[2], model_id=row[3],
                    created_at=row[4], updated_at=row[5]
                )
                for row in rows
            ]

    def get_conversation(self, conversation_id: str) -> Optional[Conversation]:
        """获取特定对话"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT id, title, system_msg, model_id, created_at, updated_at
                FROM conversations
                WHERE id = ?
            ''', (conversation_id,))

            row = cursor.fetchone()
            if row:
                return Conversation(
                    id=row[0], title=row[1], system_msg=row[2], model_id=row[3],
                    created_at=row[4], updated_at=row[5]
                )
            return None

    def get_conversation_nodes(self, conversation_id: str) -> List[ConversationNode]:
        """获取对话的所有节点"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT id, parent_id, conversation_id, node_type, content, tokens_input, tokens_output, created_at
                FROM conversation_nodes
                WHERE conversation_id = ?
                ORDER BY created_at ASC
            ''', (conversation_id,))

            rows = cursor.fetchall()
            return [
                ConversationNode(
                    id=row[0], parent_id=row[1], conversation_id=row[2],
                    node_type=row[3], content=row[4], tokens_input=row[5],
                    tokens_output=row[6], created_at=row[7]
                )
                for row in rows
            ]

    def delete_conversation(self, conversation_id: str) -> bool:
        """删除对话"""
        print(f"开始删除对话: {conversation_id}")
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()

            # 先检查对话是否存在
            cursor.execute('SELECT id FROM conversations WHERE id = ?', (conversation_id,))
            conversation_exists = cursor.fetchone()
            if not conversation_exists:
                print(f"对话 {conversation_id} 不存在")
                return {'success': False, 'nodes_deleted': 0, 'conversation_deleted': False}

            # 检查有多少个节点
            cursor.execute('SELECT COUNT(*) FROM conversation_nodes WHERE conversation_id = ?', (conversation_id,))
            nodes_count = cursor.fetchone()[0]
            print(f"对话 {conversation_id} 有 {nodes_count} 个节点")

            # 手动删除相关的节点（更可靠的方式）
            cursor.execute('DELETE FROM conversation_nodes WHERE conversation_id = ?', (conversation_id,))
            nodes_deleted = cursor.rowcount
            print(f"删除了 {nodes_deleted} 个节点")

            # 删除对话
            cursor.execute('DELETE FROM conversations WHERE id = ?', (conversation_id,))
            conversation_deleted = cursor.rowcount > 0
            print(f"删除对话结果: {conversation_deleted}")

            conn.commit()
            return {
                'success': conversation_deleted,
                'nodes_deleted': nodes_deleted,
                'conversation_deleted': conversation_deleted
            }

    def update_conversation_title(self, conversation_id: str, title: str) -> bool:
        """更新对话标题"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE conversations
                SET title = ?, updated_at = ?
                WHERE id = ?
            ''', (title, datetime.now().isoformat(), conversation_id))
            conn.commit()
            return cursor.rowcount > 0

    def get_conversation_tree(self, conversation_id: str) -> Optional[Dict]:
        """获取对话的树形结构"""
        nodes = self.get_conversation_nodes(conversation_id)
        if not nodes:
            return None

        # 构建节点字典
        node_dict = {}
        for node in nodes:
            node_data = {
                'id': node.id,
                'type': node.node_type,
                'content': node.content,
                'children': []
            }
            if node.tokens_input is not None and node.tokens_output is not None:
                node_data['tokens'] = {
                    'input': node.tokens_input,
                    'output': node.tokens_output
                }
            node_dict[node.id] = node_data

        # 构建树形结构
        root_nodes = []
        for node in nodes:
            node_data = node_dict[node.id]
            if node.parent_id is None:
                root_nodes.append(node_data)
            else:
                if node.parent_id in node_dict:
                    node_dict[node.parent_id]['children'].append(node_data)

        # 如果只有一个根节点，直接返回；否则返回根节点列表
        return root_nodes[0] if len(root_nodes) == 1 else root_nodes

    def search_conversations(self, query: str, limit: int = 20) -> List[tuple]:
        """搜索对话"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT DISTINCT c.id, c.title, c.system_msg, c.model_id, c.created_at, c.updated_at
                FROM conversations c
                LEFT JOIN conversation_nodes n ON c.id = n.conversation_id
                WHERE c.title LIKE ? OR n.content LIKE ?
                ORDER BY c.updated_at DESC
                LIMIT ?
            ''', (f'%{query}%', f'%{query}%', limit))

            return cursor.fetchall()

# 全局数据库实例
db = DatabaseManager()