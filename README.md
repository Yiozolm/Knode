# Knode - 知识节点系统

一个基于 AI 的对话式知识图谱系统，帮助用户构建交互式的知识流程图，支持深入的探索式学习和知识管理。

## 🚀 快速开始

### 环境要求

- Python 3.7+
- [uv](https://github.com/astral-sh/uv) - 现代化的 Python 包管理工具
- 现代浏览器 (支持 React 18)
- AI 模型 API Key (智谱 GLM 或其他支持的提供商)

### 配置 API Key

在启动应用之前，需要设置相应的 API Key 环境变量：

#### 方法一：使用 .env.example 模板 (推荐)

1. 复制提供的模板文件：

```bash
cp .env.example .env
```

2. 编辑 `.env` 文件，填入你的实际 API Key：

```bash
# 使用你喜欢的编辑器
nano .env  # 或 vim .env, code .env 等
```

3. 在 `.env` 文件中填入你的 API Key：

```env
# 智谱 GLM API Key (必需)
ZHIPU_API_KEY=your_zhipu_api_key_here

# 智谱 API 基础 URL (必需)
# ZHIPU_BASE_URL=https://open.bigmodel.cn/api/paas/v4/

# OpenAI API Key (如果使用 OpenAI 模型)
# OPENAI_API_KEY=your_openai_api_key_here
# OPENAI_BASE_URL=https://api.openai.com/v1
```

#### 方法二：直接设置环境变量

```bash
# macOS/Linux
export ZHIPU_API_KEY="your_zhipu_api_key_here"

# Windows (PowerShell)
$env:ZHIPU_API_KEY="your_zhipu_api_key_here"
```

#### 获取 API Key

**智谱 GLM:**

1. 访问 [智谱 AI 开放平台](https://open.bigmodel.cn/)
2. 注册并登录账号
3. 在控制台中创建新的 API Key
4. 复制 API Key 到环境变量中

**其他支持的提供商:**

- **OpenAI**: 访问 [OpenAI Platform](https://platform.openai.com/) 获取 API Key

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

### 支持的 AI 模型

#### 智谱 GLM (默认支持)

- `glm-4.6` - 最新的 GLM-4.6 模型
- `glm-4.5` - GLM-4.5 模型
- `glm-4.5-air` - 轻量级 GLM-4.5 模型 (默认)
- `glm-4` - GLM-4 基础模型

#### 其他提供商 (需要启用配置)

系统架构支持以下模型，可在配置文件中启用：

**OpenAI:**

- `gpt-4o-2024-08-06` - GPT-4o 最新版本
- `gpt-4.1-2025-04-14` - GPT-4.1 模型
- `gpt-4.1-mini-2025-04-14` - GPT-4.1 Mini 模型

### 常见问题

#### API Key 相关问题

**1. API Key 无效错误**

```bash
# 解决方案：检查 API Key 是否正确设置
echo $ZHIPU_API_KEY  # 确认环境变量已设置
```

**2. 网络连接超时**

- 检查网络连接是否正常
- 确认防火墙允许访问 API 端点

**3. API 配额不足**

- 登录相应平台检查 API 使用配额
- 考虑升级套餐或等待配额重置

**4. 模型不可用**

- 确认选择的模型在对应平台上可用
- 检查模型名称拼写是否正确

#### 启用其他模型提供商

要启用其他 AI 模型提供商，需要修改 `backend/Agents/utils.py` 文件：

```python
# 取消注释需要的模型配置
def _get_model_config(model_id: str) -> ModelConfig:
    """get model configuration"""
    configs = {
        # 启用 OpenAI 模型
        "claude": ModelConfig("claude-sonnet-4-20250514", "anthropic"),
        "gpt-4o-2024-08-06": ModelConfig("gpt-4o-2024-08-06", "openai"),

        # 启用 Google Gemini
        "gemini-2.5-pro": ModelConfig("gemini-2.5-pro", "google"),

        # 启用 Moonshot
        "kimi-k2-turbo-preview": ModelConfig("kimi-k2-turbo-preview", "moonshot"),

        # 智谱 GLM (已启用)
        "glm-4.6": ModelConfig("glm-4.6", "zhipu"),
        "glm-4.5": ModelConfig("glm-4.5", "zhipu"),
        "glm-4.5-air": ModelConfig("glm-4.5-air", "zhipu"),
        # ... 其他模型
    }
    return configs.get(model_id, configs["glm-4.5-air"])
```

**重要提醒：**

- 启用新模型后，需要设置对应的环境变量
- 重启应用以使配置生效
- 某些模型可能需要额外的依赖包

## 📁 项目结构

```
Knode/
├── main.py                 # 主启动程序
├── .env.example           # 环境变量配置模板
├── .env                   # 环境变量配置 (从 .env.example 复制)
├── pyproject.toml         # 项目依赖配置
├── backend/                # 后端代码
│   ├── app.py             # Flask 应用主文件
│   └── Agents/            # AI 代理模块
│       ├── __init__.py
│       ├── langgraph_utils.py
│       └── utils.py        # 模型配置文件
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

---

**Knode** - Link start！
