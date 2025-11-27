# Knode - 知识节点系统

一个基于 AI 的对话式知识图谱系统，帮助用户构建交互式的知识流程图，支持深入的探索式学习和知识管理。

## 🌟 主要特性

- **🤖 AI 驱动的对话系统**: 支持多种 GLM 模型，包括 GLM-4.6、GLM-4.5、GLM-4.5-Air 和 GLM-4
- **🌳 可视化知识流程图**: 将对话内容转换为树状流程图，直观展示知识结构
- **🔍 探索式学习**: 支持对任意知识点进行深入探索，构建分层知识网络
- **💬 富文本支持**: 完整支持 Markdown 渲染，包括代码高亮、数学公式显示
- **📝 对话管理**: 支持多对话管理、对话历史记录、标题编辑和搜索功能
- **🎯 交互式节点**: 点击查看详情，双击深入探索，支持文本选择触发解释
- **📊 Token 统计**: 实时显示输入输出 Token 使用情况

## 🏗️ 技术架构

### 后端 (Backend)
- **框架**: Flask + Flask-CORS
- **数据库**: SQLite3，支持对话和节点的树形存储
- **AI 集成**: LangChain + LangGraph，支持多模型切换
- **API 设计**: RESTful API，支持对话管理和实时交互

### 前端 (Frontend)
- **框架**: React 18 (通过 Babel 独立构建)
- **UI 组件**: 原生 CSS + Font Awesome 图标
- **可视化**: SVG 流程图渲染
- **富文本**: Marked.js (Markdown) + KaTeX (数学公式) + Highlight.js (代码高亮)

## 🚀 快速开始

### 环境要求
- Python 3.7+
- [uv](https://github.com/astral-sh/uv) - 现代化的 Python 包管理工具
- 现代浏览器 (支持 React 18)

### 安装步骤

1. **克隆项目**
```bash
git clone <repository-url>
cd Knode
```

2. **安装 uv (如果尚未安装)**
```bash
# macOS 和 Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# 或者使用 pipx
pipx install uv

# Windows (PowerShell)
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
```

3. **安装项目依赖**
```bash
uv sync
```

4. **启动应用**
```bash
uv run python main.py
```

5. **访问应用**
打开浏览器访问 `http://localhost:5001`

## 📁 项目结构

```
Knode/
├── main.py                 # 主启动程序
├── backend/                # 后端代码
│   ├── app.py             # Flask 应用主文件
│   └── Agents/            # AI 代理模块
│       ├── __init__.py
│       ├── langgraph_utils.py
│       └── utils.py
├── database/              # 数据库模块
│   ├── __init__.py
│   └── database.py        # 数据库管理
├── frontend/              # 前端代码
│   ├── index.html         # 主页面
│   └── app.js             # React 应用
└── README.md              # 项目说明
```

## 💡 使用指南

### 基本操作

1. **开始对话**
   - 在侧边栏设置系统消息和选择模型
   - 在输入框中输入问题开始对话

2. **查看流程图**
   - 对话内容会自动转换为可视化的流程图
   - 每个问答对形成一个节点，支持分层展示

3. **深入探索**
   - **单击节点**: 查看问答的详细内容
   - **双击节点**: 对该知识点进行深入探索
   - **选择文本**: 选择任意文本可触发进一步解释

4. **对话管理**
   - 在侧边栏查看历史对话
   - 支持加载、删除、重命名对话
   - 自动保存对话历史

### 高级功能

- **Markdown 支持**: 支持完整的 Markdown 语法，包括表格、列表、引用等
- **代码高亮**: 自动识别和语法高亮代码块
- **数学公式**: 支持 LaTeX 数学公式渲染
- **实时 Token 统计**: 显示每个回答的 Token 使用情况

## 🔧 API 接口

### 对话管理
- `POST /api/init` - 初始化 AI 助手
- `POST /api/chat` - 发送消息
- `POST /api/reset` - 重置对话

### 对话操作
- `GET /api/conversations` - 获取对话列表
- `GET /api/conversations/{id}` - 获取特定对话
- `POST /api/conversations/{id}/load` - 加载对话
- `DELETE /api/conversations/{id}` - 删除对话
- `PUT /api/conversations/{id}/title` - 更新标题
- `GET /api/conversations/search?q={query}` - 搜索对话

## 🎨 界面预览

- **现代化设计**: 采用毛玻璃效果和渐变背景
- **响应式布局**: 支持不同屏幕尺寸
- **交互式流程图**: SVG 渲染的知识网络图
- **富文本展示**: 支持代码、公式、表格的完美渲染

## 🛠️ 开发说明

### 扩展功能
- 支持添加新的 AI 模型
- 可扩展的知识节点类型
- 自定义的流程图布局算法
- 插件式的富文本渲染器

### 数据库结构
- `conversations`: 对话基本信息
- `conversation_nodes`: 对话节点，支持树形结构
- 支持外键约束和索引优化

## 📄 许可证

本项目采用 MIT 许可证。详见 LICENSE 文件。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request 来改进项目。

---

**Knode** - 让知识探索更有趣、更高效！