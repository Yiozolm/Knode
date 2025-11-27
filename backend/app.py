from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import json
import os
import uuid
from datetime import datetime
from backend.Agents import LangGraphAgent, _get_model_config
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from database.database import db, ConversationNode, Conversation
from langchain.messages import HumanMessage, AIMessage

app = Flask(__name__)
CORS(app)

# Agent management
class AgentManager:
    def __init__(self):
        self.agents = {}  # conversation_id -> agent
        self.default_system_msg = "你是一个专业的知识助手"
        self.default_model_id = "glm-4.5-air"

    def get_or_create_agent(self, conversation_id, system_msg=None, model_id=None):
        if conversation_id not in self.agents:
            system_msg = system_msg or self.default_system_msg
            model_id = model_id or self.default_model_id
            self.agents[conversation_id] = LangGraphAgent(
                system_msg=system_msg,
                config=_get_model_config(model_id)
            )
        return self.agents[conversation_id]

    def reset_agent(self, conversation_id, system_msg=None, model_id=None):
        system_msg = system_msg or self.default_system_msg
        model_id = model_id or self.default_model_id
        self.agents[conversation_id] = LangGraphAgent(
            system_msg=system_msg,
            config=_get_model_config(model_id)
        )
        return self.agents[conversation_id]

    def remove_agent(self, conversation_id):
        if conversation_id in self.agents:
            del self.agents[conversation_id]

# Global agent manager
agent_manager = AgentManager()

@app.route('/')
def index():
    return send_from_directory('../frontend', 'index.html')

@app.route('/app.js')
def serve_js():
    return send_from_directory('../frontend', 'app.js')

@app.route('/api/init', methods=['POST'])
def init_agent():
    data = request.json
    system_msg = data.get('system_msg', '你是一个专业的知识助手')
    model_id = data.get('model_id', 'glm-4.5-air')
    new_conversation = data.get('new_conversation', True)
    conversation_id = data.get('conversation_id')  # 可选的现有对话ID

    try:
        # 创建新对话或继续现有对话
        if new_conversation:
            conversation_id = db.create_conversation(
                title="新对话",
                system_msg=system_msg,
                model_id=model_id
            )

        # 获取或创建对应的agent
        agent = agent_manager.get_or_create_agent(conversation_id, system_msg, model_id)

        return jsonify({
            'success': True,
            'message': 'Agent initialized successfully',
            'conversation_id': conversation_id
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/chat', methods=['POST'])
def chat():
    data = request.json
    message = data.get('message', '')
    conversation_id = data.get('conversation_id')  # 必需的对话ID
    parent_id = data.get('parent_id')

    if not conversation_id:
        return jsonify({'success': False, 'error': 'Conversation ID is required'}), 400

    try:
        # 获取对应的agent
        agent = agent_manager.get_or_create_agent(conversation_id)

        print(f"Processing chat request for conversation {conversation_id}: {message[:50]}...")

        response = agent.step(message)
        print(f"Agent response received: {response.content[:100]}...")

        # 保存问题节点
        question_node = ConversationNode(
            id=str(uuid.uuid4()),
            parent_id=parent_id,
            conversation_id=conversation_id,
            node_type='question',
            content=message
        )
        db.save_node(question_node)
        print(f"Question node saved: {question_node.id}")

        # 保存回答节点
        answer_node = ConversationNode(
            id=str(uuid.uuid4()),
            parent_id=question_node.id,
            conversation_id=conversation_id,
            node_type='answer',
            content=response.content,
            tokens_input=response.input_tokens,
            tokens_output=response.output_tokens
        )
        db.save_node(answer_node)
        print(f"Answer node saved: {answer_node.id}")

        # 更新对话标题（使用第一个问题作为标题）
        if parent_id is None:  # 这是第一个问题
            title = message[:50] + ('...' if len(message) > 50 else '')
            db.update_conversation_title(conversation_id, title)
            print(f"Conversation title updated: {title}")

        print(f"Chat request completed successfully for conversation {conversation_id}")

        return jsonify({
            'success': True,
            'response': {
                'id': answer_node.id,
                'content': response.content,
                'input_tokens': response.input_tokens,
                'output_tokens': response.output_tokens
            },
            'question_id': question_node.id
        })
    except Exception as e:
        print(f"Error in chat for conversation {conversation_id}: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/reset', methods=['POST'])
def reset_agent():
    data = request.json
    system_msg = data.get('system_msg', agent_manager.default_system_msg)
    model_id = data.get('model_id', agent_manager.default_model_id)

    try:
        # 创建新对话
        conversation_id = db.create_conversation(
            title="新对话",
            system_msg=system_msg,
            model_id=model_id
        )

        # 重置或创建新的agent
        agent_manager.reset_agent(conversation_id, system_msg, model_id)

        return jsonify({
            'success': True,
            'message': 'Agent reset successfully',
            'conversation_id': conversation_id
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# Conversation management endpoints
@app.route('/api/conversations', methods=['GET'])
def get_conversations():
    """获取对话列表"""
    try:
        conversations = db.get_conversations()
        return jsonify({
            'success': True,
            'conversations': [
                {
                    'id': conv.id,
                    'title': conv.title,
                    'system_msg': conv.system_msg,
                    'model_id': conv.model_id,
                    'created_at': conv.created_at,
                    'updated_at': conv.updated_at
                }
                for conv in conversations
            ]
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/conversations/<conversation_id>', methods=['GET'])
def get_conversation(conversation_id):
    """获取特定对话"""
    try:
        conversation = db.get_conversation(conversation_id)
        if not conversation:
            return jsonify({'success': False, 'error': 'Conversation not found'}), 404

        tree = db.get_conversation_tree(conversation_id)
        return jsonify({
            'success': True,
            'conversation': {
                'id': conversation.id,
                'title': conversation.title,
                'system_msg': conversation.system_msg,
                'model_id': conversation.model_id,
                'created_at': conversation.created_at,
                'updated_at': conversation.updated_at,
                'tree': tree
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/conversations/<conversation_id>/load', methods=['POST'])
def load_conversation(conversation_id):
    """加载对话到当前会话"""
    try:
        conversation = db.get_conversation(conversation_id)
        if not conversation:
            return jsonify({'success': False, 'error': 'Conversation not found'}), 404

        # 重置或创建对应的agent
        agent = agent_manager.reset_agent(conversation_id, conversation.system_msg, conversation.model_id)

        # 恢复对话历史到agent
        nodes = db.get_conversation_nodes(conversation_id)
        print(f"Loading conversation {conversation_id} with {len(nodes)} nodes")
        for node in nodes:
            if node.node_type == 'question':
                agent.history.append(HumanMessage(content=node.content))
            elif node.node_type == 'answer':
                agent.history.append(AIMessage(content=node.content))

        print(f"Agent history restored with {len(agent.history)} messages")

        tree = db.get_conversation_tree(conversation_id)
        return jsonify({
            'success': True,
            'message': 'Conversation loaded successfully',
            'conversation': {
                'id': conversation.id,
                'title': conversation.title,
                'system_msg': conversation.system_msg,
                'model_id': conversation.model_id,
                'tree': tree
            }
        })
    except Exception as e:
        print(f"Error loading conversation {conversation_id}: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/conversations/<conversation_id>', methods=['DELETE'])
def delete_conversation(conversation_id):
    """删除对话"""
    try:
        print(f"收到删除对话请求: {conversation_id}")
        result = db.delete_conversation(conversation_id)
        print(f"数据库删除结果: {result}")

        if result['success']:
            # 清理对应的agent
            agent_manager.remove_agent(conversation_id)
            print(f"Agent removed for conversation {conversation_id}")

            return jsonify({
                'success': True,
                'message': 'Conversation deleted successfully',
                'nodes_deleted': result.get('nodes_deleted', 0),
                'conversation_deleted': result.get('conversation_deleted', False)
            })
        else:
            return jsonify({'success': False, 'error': 'Conversation not found'}), 404
    except Exception as e:
        print(f"删除对话时出错: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/conversations/<conversation_id>/title', methods=['PUT'])
def update_conversation_title(conversation_id):
    """更新对话标题"""
    try:
        data = request.json
        title = data.get('title', '')
        if not title.strip():
            return jsonify({'success': False, 'error': 'Title cannot be empty'}), 400

        success = db.update_conversation_title(conversation_id, title.strip())
        if success:
            return jsonify({'success': True, 'message': 'Title updated successfully'})
        else:
            return jsonify({'success': False, 'error': 'Conversation not found'}), 404
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/conversations/search', methods=['GET'])
def search_conversations():
    """搜索对话"""
    try:
        query = request.args.get('q', '')
        if not query.strip():
            return jsonify({'success': False, 'error': 'Search query cannot be empty'}), 400

        results = db.search_conversations(query.strip())
        return jsonify({
            'success': True,
            'results': [
                {
                    'id': row[0],
                    'title': row[1],
                    'system_msg': row[2],
                    'model_id': row[3],
                    'created_at': row[4],
                    'updated_at': row[5]
                }
                for row in results
            ]
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# Serve static files for React app
@app.route('/static/<path:filename>')
def serve_static(filename):
    return send_from_directory('static', filename)

if __name__ == '__main__':
    app.run(debug=True, port=5001)