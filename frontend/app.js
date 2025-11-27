const { useState, useEffect } = React;

// API 服务
const api = {
    async initAgent(systemMsg, modelId, newConversation = true) {
        const response = await fetch('/api/init', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ system_msg: systemMsg, model_id: modelId, new_conversation: newConversation })
        });
        return response.json();
    },

    async chat(message, parentId = null, conversationId) {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, parent_id: parentId, conversation_id: conversationId })
        });
        return response.json();
    },

    async resetAgent() {
        const response = await fetch('/api/reset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        return response.json();
    },

    // Conversation management APIs
    async getConversations() {
        const response = await fetch('/api/conversations');
        return response.json();
    },

    async getConversation(conversationId) {
        const response = await fetch(`/api/conversations/${conversationId}`);
        return response.json();
    },

    async loadConversation(conversationId) {
        const response = await fetch(`/api/conversations/${conversationId}/load`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        return response.json();
    },

    async deleteConversation(conversationId) {
        const response = await fetch(`/api/conversations/${conversationId}`, {
            method: 'DELETE'
        });
        return response.json();
    },

    async updateConversationTitle(conversationId, title) {
        const response = await fetch(`/api/conversations/${conversationId}/title`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title })
        });
        return response.json();
    },

    async searchConversations(query) {
        const response = await fetch(`/api/conversations/search?q=${encodeURIComponent(query)}`);
        return response.json();
    }
};

// 富文本内容渲染工具
const ContentRenderer = {
    _isInitialized: false,

    // 初始化 marked.js
    initMarked() {
        if (typeof marked !== 'undefined' && !this._isInitialized) {
            this._isInitialized = true;

            // 设置 marked.js 配置
            marked.setOptions({
                breaks: true,  // 支持换行
                gfm: true,     // GitHub Flavored Markdown
                tables: true,
                sanitize: false,
                smartLists: true,
                smartypants: true,
                sanitize: false,
                pedantic: false,
                silent: false,
                highlight: function(code, lang) {
                    // 处理 marked.js Token 对象
                    if (typeof code === 'object' && code !== null) {
                        if (code.text) {
                            code = code.text;
                        } else if (code.raw) {
                            code = code.raw;
                        } else {
                            code = String(code);
                        }
                    }

                    // 确保 code 是字符串类型
                    if (typeof code !== 'string') {
                        console.warn('Highlight function received non-string code:', typeof code, code);
                        code = String(code || '');
                    }

                    // 确保 lang 是字符串类型
                    if (typeof lang !== 'string') {
                        lang = String(lang || '');
                    }

                    try {
                        if (lang && hljs.getLanguage(lang)) {
                            return hljs.highlight(code, { language: lang }).value;
                        } else {
                            return hljs.highlightAuto(code).value;
                        }
                    } catch (e) {
                        console.warn('Highlight error:', e);
                        try {
                            return hljs.highlightAuto(code).value;
                        } catch (fallbackError) {
                            console.warn('Fallback highlighting failed:', fallbackError);
                            return code; // 返回原始代码
                        }
                    }
                }
            });

            console.log('Marked initialized successfully');
        } else if (typeof marked === 'undefined') {
            console.error('Marked library not loaded');
        }
    },

    // 处理 LaTeX 数学公式
    processLatex(content) {
        // 检查 KaTeX 是否已加载
        if (typeof katex === 'undefined') {
            console.warn('KaTeX not loaded, skipping LaTeX processing');
            return content;
        }

        console.log('Processing LaTeX in content:', content?.substring(0, 100) + '...');

        try {
            let processedContent = content;

            // 处理块级数学公式 $$...$$
            processedContent = processedContent.replace(/\$\$([^$]+)\$\$/g, (match, formula) => {
                console.log('Processing block formula:', formula);
                try {
                    const formulaTrimmed = formula.trim();
                    console.log('KaTeX available:', typeof katex !== 'undefined');

                    if (typeof katex === 'undefined' || !katex.renderToString) {
                        console.error('KaTeX or renderToString not available');
                        return `<div class="katex-display">$$${formulaTrimmed}$$</div>`;
                    }

                    const result = katex.renderToString(formulaTrimmed, {
                        displayMode: true,
                        throwOnError: false,
                        errorColor: '#cc0000'
                    });

                    console.log('KaTeX result type:', typeof result);
                    console.log('KaTeX result:', result?.substring(0, 100));

                    // 确保返回的是字符串
                    if (typeof result === 'string') {
                        // 检查结果中是否包含 [object Object]
                        if (result.includes('[object Object]')) {
                            console.warn('KaTeX result contains [object Object], using fallback');
                            return `<div class="katex-display">$$${formulaTrimmed}$$</div>`;
                        }
                        return result;
                    } else {
                        console.warn('KaTeX returned non-string for block formula:', typeof result, result);
                        return `<div class="katex-display">$$${formulaTrimmed}$$</div>`;
                    }
                } catch (e) {
                    console.warn('KaTeX block formula error:', e);
                    return `<div class="math-error">LaTeX 错误: ${formula.trim()}</div>`;
                }
            });

            // 处理内联数学公式 $...$（简化正则表达式，避免使用否定查找）
            processedContent = processedContent.replace(/\$([^$\n]+)\$/g, (match, formula, offset, fullText) => {
                // 检查是否是块级公式的一部分
                const before = fullText.substring(0, offset);
                const after = fullText.substring(offset + match.length);

                // 如果前面或后面有 $，说明是块级公式，跳过
                if (before.endsWith('$') || after.startsWith('$')) {
                    return match;
                }

                console.log('Processing inline formula:', formula);
                try {
                    const formulaTrimmed = formula.trim();

                    if (typeof katex === 'undefined' || !katex.renderToString) {
                        console.error('KaTeX or renderToString not available');
                        return `$${formulaTrimmed}$`;
                    }

                    const result = katex.renderToString(formulaTrimmed, {
                        displayMode: false,
                        throwOnError: false,
                        errorColor: '#cc0000'
                    });

                    console.log('KaTeX inline result type:', typeof result);

                    // 确保返回的是字符串
                    if (typeof result === 'string') {
                        // 检查结果中是否包含 [object Object]
                        if (result.includes('[object Object]')) {
                            console.warn('KaTeX inline result contains [object Object], using fallback');
                            return `$${formulaTrimmed}$`;
                        }
                        return result;
                    } else {
                        console.warn('KaTeX returned non-string for inline formula:', typeof result, result);
                        return `$${formulaTrimmed}$`;
                    }
                } catch (e) {
                    console.warn('KaTeX inline formula error:', e);
                    return `<span class="math-error">LaTeX 错误: ${formula.trim()}</span>`;
                }
            });

            console.log('LaTeX processing completed');
            return processedContent;
        } catch (error) {
            console.error('LaTeX processing error:', error);
            return content;
        }
    },

    // 渲染 Markdown 内容
    renderMarkdown(content) {
        // 确保 marked 已初始化
        this.initMarked();

        if (typeof marked === 'undefined') {
            console.error('Marked library is not available');
            return `<p style="color: red; background: #fee; padding: 8px; border-radius: 4px;">Markdown 渲染库未加载</p><pre>${String(content || '')}</pre>`;
        }

        // 确保 content 是字符串类型
        if (typeof content !== 'string') {
            console.warn('renderMarkdown received non-string content:', typeof content, content);
            content = String(content || '');
        }

        try {
            console.log('Starting markdown rendering for content:', content?.substring(0, 100) + '...');

            // 先处理 LaTeX 数学公式
            const processedContent = this.processLatex(content);
            console.log('LaTeX processing completed');

            // 渲染 Markdown
            const html = marked.parse(processedContent);

            // 确保 html 是字符串类型
            if (typeof html !== 'string') {
                console.error('Marked returned non-string result:', typeof html, html);
                return `<div class="render-error"><p>Markdown 渲染返回了非字符串结果</p><pre>${content}</pre></div>`;
            }

            // 检查是否包含 [object Object]
            if (html.includes('[object Object]')) {
                console.warn('Found [object Object] in rendered HTML, attempting to fix...');
                // 替换所有的 [object Object] 为更友好的提示
                const fixedHtml = html.replace(/\[object Object\]/g, '<span class="math-error">数学公式渲染错误</span>');
                console.log('Fixed [object Object] issues');
                return fixedHtml;
            }

            console.log('Markdown rendered successfully, length:', html.length);
            return html;
        } catch (error) {
            console.error('Markdown rendering error:', error);
            return `<div class="render-error"><p style="color: red; background: #fee; padding: 8px; border-radius: 4px;">Markdown 渲染错误: ${error.message}</p><pre>${content}</pre></div>`;
        }
    },

    // 渲染内容并处理数学公式
    async renderContent(content, containerElement) {
        try {
            console.log('Starting content rendering for:', content?.substring(0, 50) + '...');

            // 渲染 Markdown
            const html = this.renderMarkdown(content);

            // 设置 HTML
            containerElement.innerHTML = html;

            // 重新高亮代码块
            if (typeof hljs !== 'undefined') {
                try {
                    containerElement.querySelectorAll('pre code').forEach((block) => {
                        hljs.highlightElement(block);
                    });
                } catch (error) {
                    console.warn('Code highlighting error:', error);
                }
            }

            // 渲染剩余的数学公式（如果 KaTeX auto-render 可用）
            if (typeof renderMathInElement !== 'undefined' && typeof katex !== 'undefined') {
                try {
                    renderMathInElement(containerElement, {
                        delimiters: [
                            {left: '$$', right: '$$', display: true},
                            {left: '$', right: '$', display: false}
                        ],
                        throwOnError: false,
                        strict: false
                    });
                    console.log('KaTeX auto-render completed');
                } catch (error) {
                    console.warn('KaTeX auto-render error:', error);
                }
            }

            console.log('Content rendering completed successfully');
        } catch (error) {
            console.error('Content rendering error:', error);
            containerElement.innerHTML = `<div style="color: red; background: #fee; padding: 8px; border-radius: 4px;">内容渲染错误: ${error.message}</div><pre>${content}</pre>`;
        }
    }
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing libraries...');

    // 等待所有脚本加载完成
    setTimeout(() => {
        // 检查并初始化必要的库
        const libraries = {
            'marked': typeof marked !== 'undefined',
            'hljs': typeof hljs !== 'undefined',
            'katex': typeof katex !== 'undefined',
            'renderMathInElement': typeof renderMathInElement !== 'undefined'
        };

        console.log('=== Library Status Check ===');
        console.log('Library status:', libraries);

        // 检查必要的库是否已加载
        const missingLibraries = Object.entries(libraries)
            .filter(([, loaded]) => !loaded)
            .map(([name]) => name);

        if (missingLibraries.length > 0) {
            console.warn('❌ Missing libraries:', missingLibraries);
        } else {
            console.log('✅ All libraries loaded successfully');
        }

        // 初始化 marked
        if (libraries.marked) {
            try {
                ContentRenderer.initMarked();
                console.log('✅ Marked initialized successfully');
            } catch (error) {
                console.error('❌ Failed to initialize Marked:', error);
            }
        } else {
            console.error('❌ Marked library not available');
        }

        if (libraries.hljs) {
            console.log('✅ Highlight.js available');
        } else {
            console.warn('❌ Highlight.js not available');
        }

        if (libraries.katex) {
            console.log('✅ KaTeX available');
        } else {
            console.warn('❌ KaTeX not available');
        }

        if (libraries.renderMathInElement) {
            console.log('✅ KaTeX auto-render available');
        } else {
            console.warn('❌ KaTeX auto-render not available');
        }
        console.log('=== End Library Check ===');
    }, 200); // 增加等待时间确保脚本完全加载
});

// 作为备用方案，也在模块加载时尝试初始化
if (typeof marked !== 'undefined') {
    ContentRenderer.initMarked();
}

// 主应用组件
const App = () => {
    const [systemMsg, setSystemMsg] = useState('你是一个专业的数学老师');
    const [modelId, setModelId] = useState('glm-4.5-air');
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState({ type: 'info', message: 'AI助手已就绪' });
    const [rootNode, setRootNode] = useState(null);
    const [inputMessage, setInputMessage] = useState('');

    // Conversation management state
    const [currentConversationId, setCurrentConversationId] = useState(null);
    const [conversations, setConversations] = useState([]);
    const [showConversations, setShowConversations] = useState(false);
    const [conversationTitle, setConversationTitle] = useState('');
    const [isEditingTitle, setIsEditingTitle] = useState(false);

    // Node detail view state
    const [selectedNode, setSelectedNode] = useState(null);
    const [showNodeDetail, setShowNodeDetail] = useState(false);

    // Prevent duplicate initialization
    const [isInitialized, setIsInitialized] = useState(false);

    const showStatus = (type, message) => {
        setStatus({ type, message });
        setTimeout(() => setStatus(null), 5000);
    };

    // Conversation management functions

    const loadConversation = async (conversationId) => {
        setIsLoading(true);
        try {
            const result = await api.loadConversation(conversationId);
            if (result.success) {
                setIsInitialized(true);
                setCurrentConversationId(conversationId);
                setRootNode(result.conversation.tree);
                setSystemMsg(result.conversation.system_msg);
                setModelId(result.conversation.model_id);
                setConversationTitle(result.conversation.title);
                setShowConversations(false);
                showStatus('success', '对话加载成功！');

                // 刷新对话列表（使用不触发智能初始化的版本）
                const conversationsResult = await api.getConversations();
                if (conversationsResult.success) {
                    setConversations(conversationsResult.conversations);
                }
            } else {
                showStatus('error', `加载对话失败: ${result.error}`);
            }
        } catch (error) {
            showStatus('error', `网络错误: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const deleteConversation = async (conversationId) => {
        if (!confirm('确定要删除这个对话吗？此操作不可撤销。')) {
            return;
        }

        try {
            console.log('开始删除对话:', conversationId);
            const result = await api.deleteConversation(conversationId);
            console.log('删除API返回结果:', result);

            if (result.success) {
                const nodesDeleted = result.nodes_deleted || 0;
                const message = nodesDeleted > 0
                    ? `对话删除成功！已删除 ${nodesDeleted} 个节点`
                    : '对话删除成功！';
                showStatus('success', message);

                // 如果删除的是当前对话，重置状态
                if (conversationId === currentConversationId) {
                    console.log('删除的是当前对话，重置状态');
                    handleReset();
                }

                // 刷新对话列表
                console.log('刷新对话列表');
                await loadConversations();
            } else {
                showStatus('error', `删除对话失败: ${result.error}`);
            }
        } catch (error) {
            console.error('删除对话时出错:', error);
            showStatus('error', `网络错误: ${error.message}`);
        }
    };

    const updateTitle = async () => {
        if (!conversationTitle.trim()) {
            showStatus('error', '标题不能为空');
            return;
        }

        try {
            const result = await api.updateConversationTitle(currentConversationId, conversationTitle.trim());
            if (result.success) {
                showStatus('success', '标题更新成功！');
                setIsEditingTitle(false);
                loadConversations();
            } else {
                showStatus('error', `更新标题失败: ${result.error}`);
            }
        } catch (error) {
            showStatus('error', `网络错误: ${error.message}`);
        }
    };

    // Load conversations on component mount with smart initialization
    useEffect(() => {
        loadConversationsEnhanced();
    }, []);

    // Original loadConversations for manual refresh (without smart initialization)
    const loadConversations = async () => {
        try {
            const result = await api.getConversations();
            if (result.success) {
                setConversations(result.conversations);
            }
        } catch (error) {
            console.error('Failed to load conversations:', error);
        }
    };

    // 智能初始化对话 - 只在必要时创建新对话
    const smartInitializeConversation = async (loadedConversations) => {
        try {
            // 防止重复初始化
            if (isInitialized || currentConversationId) {
                console.log('Already initialized, skipping');
                return;
            }

            // 检查是否有现有对话
            if (loadedConversations && loadedConversations.length > 0) {
                // 找到最近更新的对话
                const latestConversation = loadedConversations.reduce((latest, current) => {
                    return new Date(current.updated_at) > new Date(latest.updated_at) ? current : latest;
                });

                // 如果有最近更新的对话，自动加载它
                console.log('Loading latest conversation:', latestConversation.id);
                await loadConversation(latestConversation.id);
                setIsInitialized(true);
                return;
            }

            // 只有在没有现有对话时才创建新对话
            console.log('No existing conversations found, creating new one');
            const initResult = await api.initAgent(systemMsg, modelId);
            if (initResult.success) {
                setCurrentConversationId(initResult.conversation_id);
                setIsInitialized(true);
                showStatus('success', 'AI助手初始化成功！');
                // 重新加载对话列表以包含新创建的对话
                await loadConversations();
            } else {
                showStatus('error', `初始化失败: ${initResult.error}`);
            }
        } catch (error) {
            showStatus('error', `网络错误: ${error.message}`);
        }
    };

    // 加载对话列表的增强版本
    const loadConversationsEnhanced = async () => {
        try {
            const result = await api.getConversations();
            if (result.success) {
                setConversations(result.conversations);
                // 在加载完对话列表后进行智能初始化
                await smartInitializeConversation(result.conversations);
            }
        } catch (error) {
            console.error('Failed to load conversations:', error);
        }
    };

    const handleChat = async () => {
        if (!inputMessage.trim()) return;

        setIsLoading(true);
        try {
            // 如果还没有对话ID，先初始化AI助手
            if (!currentConversationId) {
                const initResult = await api.initAgent(systemMsg, modelId);
                if (!initResult.success) {
                    showStatus('error', `初始化失败: ${initResult.error}`);
                    return;
                }
                setCurrentConversationId(initResult.conversation_id);
                showStatus('success', 'AI助手初始化成功！');
                loadConversations();
            }

            const result = await api.chat(inputMessage, null, currentConversationId);
            if (result.success) {
                // 使用后端返回的数据库节点ID和结构
                const newNode = {
                    id: result.question_id,
                    type: 'question',
                    content: inputMessage,
                    children: [{
                        id: result.response.id,
                        type: 'answer',
                        content: result.response.content,
                        tokens: {
                            input: result.response.input_tokens,
                            output: result.response.output_tokens
                        },
                        children: []
                    }]
                };

                if (rootNode) {
                    setRootNode(prevRoot => addToTree(prevRoot, newNode));
                } else {
                    setRootNode(newNode);
                }
                setInputMessage('');

                // 刷新对话列表以更新时间戳
                loadConversations();
            } else {
                showStatus('error', `对话失败: ${result.error}`);
            }
        } catch (error) {
            showStatus('error', `网络错误: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleReset = async () => {
        setIsLoading(true);
        try {
            const result = await api.resetAgent();
            if (result.success) {
                setRootNode(null);
                setCurrentConversationId(result.conversation_id);
                setConversationTitle('');
                setIsEditingTitle(false);
                setIsInitialized(true); // 标记为已初始化
                showStatus('success', '对话已重置');

                // 刷新对话列表（使用不触发智能初始化的版本）
                const conversationsResult = await api.getConversations();
                if (conversationsResult.success) {
                    setConversations(conversationsResult.conversations);
                }
            } else {
                showStatus('error', `重置失败: ${result.error}`);
            }
        } catch (error) {
            showStatus('error', `网络错误: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleExplore = async (explorePrompt, parentNodeId) => {
        console.log('handleExplore called with', { explorePrompt, parentNodeId });
        console.log('Current rootNode before:', rootNode);
        setIsLoading(true);
        showStatus('info', '正在深入探索知识点...');

        try {
            // 第一步：创建临时的子问题节点（显示loading状态）
            const tempQuestionId = 'temp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
            console.log('Creating temp question node with ID:', tempQuestionId);

            const tempQuestionNode = {
                id: tempQuestionId,
                type: 'question',
                content: explorePrompt,
                isLoading: true, // 标记正在加载
                children: []
            };

            console.log('Adding temp question node to tree:', tempQuestionNode);

            // 立即添加问题节点到树中
            const treeWithQuestion = addToParent(rootNode, parentNodeId, tempQuestionNode);
            setRootNode(treeWithQuestion);
            showStatus('info', '问题已添加，正在生成回答...');

            // 第二步：调用API获取回答
            console.log('Calling API with prompt:', explorePrompt);
            console.log('Using currentConversationId:', currentConversationId);
            console.log('Using parentNodeId:', parentNodeId);

            const result = await api.chat(explorePrompt, parentNodeId, currentConversationId);
            console.log('API result:', result);

            if (result.success) {
                // 创建完整的回答节点
                const answerNode = {
                    id: result.response.id,
                    type: 'answer',
                    content: result.response.content,
                    tokens: {
                        input: result.response.input_tokens,
                        output: result.response.output_tokens
                    },
                    children: []
                };

                // 更新问题节点，移除loading状态并添加回答
                const updatedQuestionNode = {
                    ...tempQuestionNode,
                    id: result.question_id, // 使用真实的ID
                    isLoading: false,
                    children: [answerNode]
                };

                console.log('Updating question node with answer:', updatedQuestionNode);

                // 更新树结构，替换临时节点
                const finalTree = replaceNode(treeWithQuestion, tempQuestionId, updatedQuestionNode);
                console.log('Final tree after API call:', finalTree);
                setRootNode(finalTree);

                // 刷新对话列表以更新时间戳
                loadConversations();
                showStatus('success', '探索完成');
            } else {
                // 如果API调用失败，移除临时的问题节点或标记为错误
                const errorNode = {
                    ...tempQuestionNode,
                    isLoading: false,
                    hasError: true,
                    errorMessage: result.error
                };
                const errorTree = replaceNode(treeWithQuestion, tempQuestionId, errorNode);
                setRootNode(errorTree);
                showStatus('error', `探索失败: ${result.error}`);
            }
        } catch (error) {
            console.error('Error in handleExplore:', error);
            showStatus('error', `网络错误: ${error.message}`);
            // 这里可以添加错误处理逻辑
        } finally {
            setIsLoading(false);
        }
    };

    const addToTree = (tree, newNode) => {
        return { ...newNode, children: [tree] };
    };

    const addToParent = (node, parentId, newNode) => {
        console.log('addToParent called with:', { nodeId: node.id, parentId, newNodeId: newNode.id });

        if (node.id === parentId) {
            console.log('Found parent node, adding child');
            return {
                ...node,
                children: node.children ? [...node.children, newNode] : [newNode]
            };
        }
        if (node.children) {
            console.log('Searching in children of node:', node.id);
            return {
                ...node,
                children: node.children.map(child => addToParent(child, parentId, newNode))
            };
        }
        console.log('Node', node.id, 'is not the parent and has no children');
        return node;
    };

    const replaceNode = (node, targetId, newNode) => {
        console.log('replaceNode called with:', { nodeId: node.id, targetId, newNodeId: newNode.id });

        if (node.id === targetId) {
            console.log('Found target node, replacing with:', newNode);
            return newNode;
        }
        if (node.children) {
            console.log('Searching in children of node:', node.id);
            return {
                ...node,
                children: node.children.map(child => replaceNode(child, targetId, newNode))
            };
        }
        console.log('Node', node.id, 'is not the target and has no children');
        return node;
    };

    // Node detail view functions
    const handleNodeClick = (node) => {
        setSelectedNode(node);
        setShowNodeDetail(true);
    };

    const handleCloseDetail = () => {
        setShowNodeDetail(false);
        setSelectedNode(null);
    };

    return (
        <div className="app">
            <div className="header">
                <h1>
                    <i className="fas fa-network-wired"></i>
                    Knode - 知识节点系统
                </h1>
            </div>

            <div className="main-container">
                <div className="sidebar">
                    <div className="model-selector">
                        <label>选择模型:</label>
                        <select value={modelId} onChange={(e) => setModelId(e.target.value)}>
                            <option value="glm-4.6">GLM-4.6</option>
                            <option value="glm-4.5">GLM-4.5</option>
                            <option value="glm-4.5-air">GLM-4.5-Air</option>
                            <option value="glm-4">GLM-4</option>
                        </select>
                    </div>

                    <div className="system-msg">
                        <label>系统消息:</label>
                        <textarea
                            value={systemMsg}
                            onChange={(e) => setSystemMsg(e.target.value)}
                            placeholder="定义AI助手的角色和能力..."
                        />
                    </div>

                    {isInitialized && (
                        <div className="input-container">
                            <button
                                className="init-btn"
                                onClick={handleReset}
                                disabled={isLoading}
                                style={{ marginTop: '10px' }}
                            >
                                <i className="fas fa-redo"></i>
                                重置对话
                            </button>
                        </div>
                    )}

                    {/* 对话管理部分 */}
                    <div className="conversation-section">
                        <div className="conversation-header">
                            <h3>
                                <i className="fas fa-history"></i>
                                对话历史
                            </h3>
                            <button
                                className="toggle-conversations-btn"
                                onClick={() => setShowConversations(!showConversations)}
                            >
                                <i className={`fas fa-chevron-${showConversations ? 'up' : 'down'}`}></i>
                            </button>
                        </div>

                        {showConversations && (
                            <div className="conversation-list">
                                {conversations.length > 0 ? (
                                    conversations.map(conv => (
                                        <div
                                            key={conv.id}
                                            className={`conversation-item ${conv.id === currentConversationId ? 'active' : ''}`}
                                        >
                                            <div
                                                className="conversation-info"
                                                onClick={() => loadConversation(conv.id)}
                                            >
                                                <div className="conversation-title">{conv.title}</div>
                                                <div className="conversation-meta">
                                                    {new Date(conv.updated_at).toLocaleDateString()} • {conv.model_id}
                                                </div>
                                            </div>
                                            <div className="conversation-actions">
                                                <button
                                                    className="conversation-action-btn load"
                                                    onClick={() => loadConversation(conv.id)}
                                                    title="加载对话"
                                                >
                                                    <i className="fas fa-folder-open"></i>
                                                </button>
                                                <button
                                                    className="conversation-action-btn"
                                                    onClick={() => deleteConversation(conv.id)}
                                                    title="删除对话"
                                                >
                                                    <i className="fas fa-trash"></i>
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="empty-conversations">
                                        暂无对话历史
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* 当前对话标题编辑 */}
                    {isInitialized && currentConversationId && (
                        <div className="conversation-section">
                            <div className="conversation-title-section">
                                <label style={{ fontSize: '14px', color: '#4a5568', margin: 0 }}>当前对话:</label>
                                {isEditingTitle ? (
                                    <>
                                        <input
                                            type="text"
                                            className="conversation-title-input"
                                            value={conversationTitle}
                                            onChange={(e) => setConversationTitle(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && updateTitle()}
                                            placeholder="输入对话标题"
                                        />
                                        <button
                                            className="save-title-btn"
                                            onClick={updateTitle}
                                            disabled={!conversationTitle.trim()}
                                        >
                                            保存
                                        </button>
                                        <button
                                            className="cancel-edit-btn"
                                            onClick={() => {
                                                setIsEditingTitle(false);
                                                // 重置为当前对话的标题
                                                const currentConv = conversations.find(c => c.id === currentConversationId);
                                                setConversationTitle(currentConv ? currentConv.title : '');
                                            }}
                                        >
                                            取消
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <span style={{ flex: 1, fontSize: '14px', color: '#2d3748' }}>
                                            {conversationTitle || '未命名对话'}
                                        </span>
                                        <button
                                            className="edit-title-btn"
                                            onClick={() => setIsEditingTitle(true)}
                                            title="编辑标题"
                                        >
                                            <i className="fas fa-edit"></i>
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="tree-container">
                    {status && (
                        <div className={`status ${status.type}`}>
                            {status.message}
                        </div>
                    )}

                    <div className="input-group">
                        <input
                            type="text"
                            value={inputMessage}
                            onChange={(e) => setInputMessage(e.target.value)}
                            placeholder="输入你的问题..."
                            onKeyDown={(e) => e.key === 'Enter' && handleChat()}
                            disabled={isLoading}
                        />
                        <button
                            onClick={handleChat}
                            disabled={isLoading || !inputMessage.trim()}
                        >
                            {isLoading ? (
                                <div className="loading">
                                    <div className="spinner"></div>
                                    思考中...
                                </div>
                            ) : (
                                <>
                                    <i className="fas fa-paper-plane"></i>
                                    发送
                                </>
                            )}
                        </button>
                    </div>

                    <div className="tree">
                        {rootNode ? (
                            <FlowChart
                                rootNode={rootNode}
                                onNodeClick={handleNodeClick}
                                onExplore={handleExplore}
                            />
                        ) : (
                            <div className="empty-state">
                                <i className="fas fa-comments"></i>
                                <p>开始你的第一个问题来构建知识流程图</p>
                            </div>
                        )}
                    </div>

                    {/* 节点详情视图 */}
                    {showNodeDetail && (
                        <NodeDetailView
                            node={selectedNode}
                            onClose={handleCloseDetail}
                            onExplore={handleExplore}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

// FlowChart组件
const FlowChart = ({ rootNode, onNodeClick, onExplore }) => {
    if (!rootNode) return null;

    console.log('FlowChart rendering with rootNode:', rootNode);
    console.log('RootNode children count:', rootNode.children?.length || 0);

    // 将树形结构转换为问答组合节点列表
    const flattenQAPairs = (node, nodes = [], level = 0, parent = null) => {
        const qaPair = {
            id: node.id,
            question: node.type === 'question' ? {...node} : null,
            answer: null,
            children: [],
            level,
            parent,
            x: 0,
            y: 0,
            content: node.content,
            type: 'qa-pair',
            isLoading: node.isLoading || false,
            hasError: node.hasError || false,
            errorMessage: node.errorMessage || null
        };

        // 查找该问题的回答节点
        if (node.children && node.children.length > 0) {
            const answerNode = node.children.find(child => child.type === 'answer');
            if (answerNode) {
                qaPair.answer = {...answerNode};

                // 检查回答节点是否有子节点（探索问题）
                if (answerNode.children && answerNode.children.length > 0) {
                    const exploreChildren = answerNode.children.filter(child => child.type === 'question');
                    qaPair.children = exploreChildren;
                }
            }

            // 查找进一步的探索子节点（排除回答节点）
            const directExploreChildren = node.children.filter(child => child.type !== 'answer');
            if (directExploreChildren.length > 0) {
                qaPair.children = [...(qaPair.children || []), ...directExploreChildren];
            }
        }

        nodes.push(qaPair);

        // 递归处理子节点
        if (qaPair.children && qaPair.children.length > 0) {
            qaPair.children.forEach(child => {
                flattenQAPairs(child, nodes, level + 1, qaPair);
            });
        }

        return nodes;
    };

    // 计算节点位置
    const calculateNodePositions = (nodes) => {
        const levelCounts = {};
        const levelPositions = {};

        // 统计每层的节点数量
        nodes.forEach(node => {
            if (!levelCounts[node.level]) {
                levelCounts[node.level] = 0;
            }
            levelCounts[node.level]++;
        });

        // 为每层分配位置
        Object.keys(levelCounts).forEach(level => {
            const nodeCount = levelCounts[level];
            const spacing = 200; // 节点间距
            const totalWidth = (nodeCount - 1) * spacing;
            const startX = -totalWidth / 2;

            levelPositions[level] = {
                count: 0,
                startX: startX,
                spacing: spacing
            };
        });

        // 设置每个节点的x, y坐标
        nodes.forEach(node => {
            const levelPos = levelPositions[node.level];
            node.x = levelPos.startX + levelPos.count * levelPos.spacing;
            node.y = node.level * 150; // 垂直间距
            levelPos.count++;
        });

        return nodes;
    };

    const nodes = flattenQAPairs(rootNode);
    const positionedNodes = calculateNodePositions(nodes);

    // 计算连线的路径
    const getConnectorPath = (parentNode, childNode) => {
        const startX = parentNode.x;
        const startY = parentNode.y + 60; // 问答组合节点高度的一半
        const endX = childNode.x;
        const endY = childNode.y - 60; // 上边界的偏移

        // 创建贝塞尔曲线路径
        const midY = (startY + endY) / 2;
        return `M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`;
    };

    // 处理节点双击事件 - 探索节点内容
    const handleNodeDoubleClick = (node, event) => {
        event.stopPropagation();
        if (node.answer) {
            const explorePrompt = `请详细解释这个知识点：${node.answer.content}`;
            onExplore(explorePrompt, node.answer.id);
        }
    };

    return (
        <div className="flow-chart">
            <svg className="flow-chart-svg" width="100%" height="500">
                <g transform="translate(400, 50)">
                    {/* 绘制连线 */}
                    {positionedNodes.map(node => {
                        const originalNode = nodes.find(n => n.id === node.id);
                        if (originalNode && originalNode.children) {
                            return originalNode.children.map((child) => {
                                const childNode = positionedNodes.find(n => n.id === child.id);
                                if (childNode) {
                                    return (
                                        <path
                                            key={`${node.id}-${child.id}`}
                                            d={getConnectorPath(node, childNode)}
                                            fill="none"
                                            stroke="#cbd5e0"
                                            strokeWidth="2"
                                            markerEnd="url(#arrowhead)"
                                        />
                                    );
                                }
                                return null;
                            });
                        }
                        return null;
                    })}

                    {/* 定义箭头标记 */}
                    <defs>
                        <marker
                            id="arrowhead"
                            markerWidth="10"
                            markerHeight="10"
                            refX="9"
                            refY="3"
                            orient="auto"
                        >
                            <polygon
                                points="0 0, 10 3, 0 6"
                                fill="#cbd5e0"
                            />
                        </marker>
                    </defs>

                    {/* 绘制问答组合节点 */}
                    {positionedNodes.map(node => {
                        const isLoading = node.question && node.question.isLoading;
                        const hasError = node.question && node.question.hasError;

                        return (
                            <g
                                key={node.id}
                                transform={`translate(${node.x}, ${node.y})`}
                                onClick={() => onNodeClick(node)}
                                onDoubleClick={(e) => {
                                    if (node.answer) {
                                        handleNodeDoubleClick(node, e);
                                    }
                                }}
                                className={`flow-node ${isLoading ? 'loading' : ''} ${hasError ? 'error' : ''}`}
                                title={isLoading ? "正在生成回答..." : hasError ? "生成失败" : "单击查看详情，双击深入探索"}
                            >
                                {/* 问答组合容器 */}
                                <rect
                                    x="-100"
                                    y="-50"
                                    width="200"
                                    height="100"
                                    rx="10"
                                    className={`flow-node-rect qa-pair ${isLoading ? 'loading' : ''} ${hasError ? 'error' : ''}`}
                                />

                                {/* 问题部分 */}
                                <rect
                                    x="-90"
                                    y="-40"
                                    width="180"
                                    height="40"
                                    rx="6"
                                    className="flow-question-section"
                                />
                                <text
                                    x="0"
                                    y="-25"
                                    textAnchor="middle"
                                    className="flow-node-title question-title"
                                    dominantBaseline="middle"
                                    textLength="140"
                                    lengthAdjust="spacingAndGlyphs"
                                >
                                    Q: {node.question ? truncateText(node.question.content, 25, 140) : '问题...'}
                                </text>

                                {/* 分隔线 */}
                                <line
                                    x1="-70"
                                    y1="-5"
                                    x2="70"
                                    y2="-5"
                                    stroke="#e9ecef"
                                    strokeWidth="1"
                                />

                                {/* 回答部分或loading状态 */}
                                {isLoading && (
                                    <g className="loading-indicator">
                                        {/* Loading spinner */}
                                        <circle cx="0" cy="15" r="8" fill="none" stroke="#667eea" strokeWidth="2" strokeDasharray="4 2">
                                            <animateTransform
                                                attributeName="transform"
                                                type="rotate"
                                                from="0 0 15"
                                                to="360 0 15"
                                                dur="2s"
                                                repeatCount="indefinite"
                                            />
                                        </circle>
                                        <text
                                            x="0"
                                            y="35"
                                            textAnchor="middle"
                                            className="loading-text"
                                            fontSize="12"
                                            fill="#667eea"
                                        >
                                            生成中...
                                        </text>
                                    </g>
                                )}

                                {hasError && (
                                    <g className="error-indicator">
                                        {/* Error icon */}
                                        <circle cx="0" cy="15" r="10" fill="#f56565" />
                                        <text
                                            x="0"
                                            y="20"
                                            textAnchor="middle"
                                            className="error-text"
                                            fontSize="16"
                                            fill="white"
                                            fontWeight="bold"
                                        >
                                            !
                                        </text>
                                        <text
                                            x="0"
                                            y="35"
                                            textAnchor="middle"
                                            className="error-message"
                                            fontSize="12"
                                            fill="#f56565"
                                        >
                                            失败
                                        </text>
                                    </g>
                                )}

                                {!isLoading && !hasError && node.answer && (
                                    <text
                                        x="0"
                                        y="15"
                                        textAnchor="middle"
                                        dominantBaseline="middle"
                                        className="flow-node-content answer-content"
                                        textLength="140"
                                        lengthAdjust="spacingAndGlyphs"
                                    >
                                        A: {truncateText(node.answer.content, 25, 140)}
                                    </text>
                                )}

                                {!isLoading && !hasError && !node.answer && (
                                    <text
                                        x="0"
                                        y="15"
                                        textAnchor="middle"
                                        className="empty-answer-text"
                                        fontSize="12"
                                        fill="#a0aec0"
                                    >
                                        等待回答...
                                    </text>
                                )}
                            </g>
                        );
                    })}
                </g>
            </svg>
        </div>
    );
};

// React 组件用于渲染富内容，支持文本选择
const RichContentRenderer = ({ content, nodeId, onTextSelect }) => {
    const containerRef = React.useRef(null);

    React.useEffect(() => {
        if (containerRef.current && content) {
            // 延迟渲染以确保 DOM 已准备好
            const timer = setTimeout(async () => {
                try {
                    const container = containerRef.current;

                    // 使用ContentRenderer来渲染Markdown内容
                    await ContentRenderer.renderContent(content, container);

                    // 确保代码块高亮
                    if (typeof hljs !== 'undefined') {
                        try {
                            container.querySelectorAll('pre code').forEach((block) => {
                                hljs.highlightElement(block);
                            });
                        } catch (error) {
                            console.warn('Code highlighting error:', error);
                        }
                    }

                    // 改进的选择处理逻辑 - 防止闪烁
                    let isSelecting = false;
                    let lastSelectionText = '';
                    let selectionTimeout = null;

                    const handleSelectionChange = () => {
                        // 防抖处理，避免频繁触发
                        if (selectionTimeout) {
                            clearTimeout(selectionTimeout);
                        }

                        selectionTimeout = setTimeout(() => {
                            if (isSelecting) return; // 如果正在选择，跳过

                            const selection = window.getSelection();
                            const selectedText = selection.toString().trim();

                            // 只在选择改变且有效时处理
                            if (selectedText !== lastSelectionText && selectedText.length > 0) {
                                console.log('Selection changed:', {
                                    selectedText,
                                    lastSelectionText,
                                    rangeCount: selection.rangeCount
                                });

                                // 清除所有现有的工具提示
                                const existingTooltips = document.querySelectorAll('.selection-tooltip');
                                existingTooltips.forEach(tooltip => tooltip.remove());

                                try {
                                    const range = selection.getRangeAt(0);
                                    const rect = range.getBoundingClientRect();

                                    // 确保选择在当前容器内
                                    if (container.contains(range.commonAncestorContainer)) {
                                        console.log('Creating tooltip for:', selectedText);
                                        createTooltip(rect, selectedText);
                                    }
                                } catch (e) {
                                    console.error('Selection error:', e);
                                }

                                lastSelectionText = selectedText;
                            } else if (selectedText.length === 0 && lastSelectionText.length > 0) {
                                // 清除工具提示当选择被清除时
                                const existingTooltips = document.querySelectorAll('.selection-tooltip');
                                existingTooltips.forEach(tooltip => tooltip.remove());
                                lastSelectionText = '';
                            }
                        }, 50); // 50ms防抖延迟
                    };

                    const handleMouseDown = (event) => {
                        // 只处理左键点击
                        if (event.button === 0) {
                            isSelecting = true;
                        }
                    };

                    const handleMouseUp = (event) => {
                        // 只处理左键点击
                        if (event.button === 0) {
                            isSelecting = false;
                            // 延迟处理选择变化，确保选择已完成
                            setTimeout(handleSelectionChange, 10);
                        }
                    };

                    // 存储监听器引用以便后续清理
                    container._textSelectionListeners = [
                        {event: 'mousedown', handler: handleMouseDown},
                        {event: 'mouseup', handler: handleMouseUp}
                    ];
                    container._selectionChangeHandler = handleSelectionChange;

                    // 添加事件监听器
                    container.addEventListener('mousedown', handleMouseDown);
                    container.addEventListener('mouseup', handleMouseUp);
                    document.addEventListener('selectionchange', handleSelectionChange);

                } catch (error) {
                    console.error('Rendering error:', error);
                }
            }, 50); // 增加延迟时间确保库已加载

            return () => {
                clearTimeout(timer);

                // 清理事件监听器
                const container = containerRef.current;
                if (container) {
                    const listeners = container._textSelectionListeners || [];
                    listeners.forEach(({event, handler}) => {
                        container.removeEventListener(event, handler);
                    });

                    if (container._selectionChangeHandler) {
                        document.removeEventListener('selectionchange', container._selectionChangeHandler);
                    }
                }
            };
        }
    }, [content, nodeId]);

    // 创建工具提示的函数
    const createTooltip = (rect, selectedText) => {
        // 先移除任何现有的tooltip，防止重复
        const existingTooltips = document.querySelectorAll('.selection-tooltip');
        existingTooltips.forEach(el => {
            el.remove();
        });

        // tooltip创建时会保存当前选择

        const tooltipElement = document.createElement('div');
        tooltipElement.className = 'selection-tooltip';
        tooltipElement.innerHTML = '<i class="fas fa-search-plus"></i> 进一步解释';

        // 改进的位置计算 - 考虑滚动和视窗边界
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

        const tooltipWidth = 150; // tooltip的大约宽度
        const tooltipHeight = 32;  // tooltip的大约高度

        const tooltipX = rect.left + scrollLeft + (rect.width / 2) - (tooltipWidth / 2);
        let tooltipY = rect.top + scrollTop - tooltipHeight - 10;

        // 确保tooltip不会超出视窗上边界
        if (tooltipY < scrollTop + 10) {
            tooltipY = rect.top + scrollTop + rect.height + 10; // 显示在文本下方
        }

        tooltipElement.style.position = 'fixed';
        tooltipElement.style.left = `${Math.max(10, Math.min(tooltipX, window.innerWidth - tooltipWidth - 10))}px`;
        tooltipElement.style.top = `${Math.max(10, tooltipY)}px`;
        tooltipElement.style.zIndex = '10000'; // 确保在最上层
        tooltipElement.style.pointerEvents = 'auto'; // 确保可以点击
        tooltipElement.style.userSelect = 'none'; // 防止tooltip被选择

        // 添加到文档
        document.body.appendChild(tooltipElement);

        // 标记tooltip，防止重复创建
        tooltipElement._createdAt = Date.now();
        tooltipElement._selectedText = selectedText;

        // 点击处理
        const handleClick = (event) => {
            event.stopPropagation();
            event.preventDefault();
            console.log('Tooltip clicked for:', selectedText);

            // 防止重复点击
            if (tooltipElement._clicked) {
                return;
            }
            tooltipElement._clicked = true;

            // 保存选择状态，因为点击可能会清除选择
            const savedText = selectedText;
            const savedNodeId = nodeId;

            // 立即移除工具提示
            tooltipElement.remove();

            // 调用回调
            if (onTextSelect) {
                onTextSelect(savedText.trim(), savedNodeId);
            }
        };

        // 鼠标进入时暂停自动移除计时器
        let autoRemoveTimeout;
        const handleMouseEnter = () => {
            if (autoRemoveTimeout) {
                clearTimeout(autoRemoveTimeout);
            }
        };

        // 鼠标离开时重新设置自动移除
        const handleMouseLeave = () => {
            autoRemoveTimeout = setTimeout(() => {
                if (document.body.contains(tooltipElement)) {
                    tooltipElement.remove();
                }
            }, 2000); // 2秒后自动移除
        };

        tooltipElement.addEventListener('click', handleClick);
        tooltipElement.addEventListener('mouseenter', handleMouseEnter);
        tooltipElement.addEventListener('mouseleave', handleMouseLeave);

        // 自动移除tooltip（如果用户没有点击）
        autoRemoveTimeout = setTimeout(() => {
            if (document.body.contains(tooltipElement)) {
                tooltipElement.remove();
            }
        }, 5000); // 5秒后自动移除
    };

    return (
        <div className="node-content" style={{ position: 'relative' }}>
            <div
                ref={containerRef}
                style={{ minHeight: '20px' }}
            />
        </div>
    );
};

// 简单的树节点组件（用于显示对话树）
const SimpleTreeNode = ({ node, level = 0 }) => {
    const [isExpanded, setIsExpanded] = useState(level < 2);

    return (
        <div className="simple-node" style={{ marginLeft: `${level * 20}px` }}>
            <div className="simple-node-header">
                <div className={`node-type ${node.type}`}>
                    <i className={`fas fa-${node.type === 'question' ? 'question-circle' : 'lightbulb'}`}></i>
                    {node.type === 'question' ? '问题' : '回答'}
                </div>
                <button
                    className="expand-btn"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <i className={`fas fa-chevron-${isExpanded ? 'up' : 'down'}`}></i>
                </button>
            </div>
            {isExpanded && (
                <div className="simple-node-content">
                    <div className="content-preview">{node.content.substring(0, 100)}...</div>
                    {node.children && node.children.length > 0 && (
                        <div className="simple-node-children">
                            {node.children.map(child => (
                                <SimpleTreeNode key={child.id} node={child} level={level + 1} />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// 节点详情视图组件
const NodeDetailView = ({ node, onClose, onExplore }) => {
    if (!node) return null;

    // 处理文本选择的探索函数
    const handleTextSelectFromDetail = (selectedText, nodeId) => {
        const explainPrompt = `请详细解释以下内容：\n\n"${selectedText}"\n\n请提供深入的解释，包括相关概念、原理和应用场景。`;
        onExplore(explainPrompt, nodeId);
    };

    // 如果是问答组合节点
    if (node.type === 'qa-pair') {
        return (
            <div className="node-detail-overlay" onClick={onClose}>
                <div className="node-detail-content" onClick={(e) => e.stopPropagation()}>
                    <div className="node-detail-header">
                        <div className="node-type qa-pair">
                            <i className="fas fa-comments"></i>
                            问答组合
                        </div>
                        <button className="close-btn" onClick={onClose}>
                            <i className="fas fa-times"></i>
                        </button>
                    </div>

                    <div className="node-detail-body">
                        {/* 问题部分 */}
                        <div className="qa-section">
                            <h3 className="qa-header question-header">
                                <i className="fas fa-question-circle"></i>
                                问题
                            </h3>
                            <div className="qa-content question-content">
                                {node.question && (
                                    <RichContentRenderer
                                        content={node.question.content}
                                        nodeId={node.question.id}
                                        onTextSelect={handleTextSelectFromDetail}
                                    />
                                )}
                            </div>
                        </div>

                        {/* 分隔线 */}
                        <div className="qa-divider"></div>

                        {/* 回答部分 */}
                        <div className="qa-section">
                            <h3 className="qa-header answer-header">
                                <i className="fas fa-lightbulb"></i>
                                回答
                            </h3>
                            <div className="qa-content answer-content">
                                {node.answer && (
                                    <RichContentRenderer
                                        content={node.answer.content}
                                        nodeId={node.answer.id}
                                        onTextSelect={handleTextSelectFromDetail}
                                    />
                                )}

                                {/* 显示回答的token信息 */}
                                {node.answer && node.answer.tokens && (
                                    <div className="token-info">
                                        <div className="token-stats">
                                            <span>输入令牌: <strong>{node.answer.tokens.input}</strong></span>
                                            <span>输出令牌: <strong>{node.answer.tokens.output}</strong></span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="node-detail-footer">
                        <button className="back-btn" onClick={onClose}>
                            <i className="fas fa-arrow-left"></i>
                            返回流程图
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // 兼容旧的单节点显示
    return (
        <div className="node-detail-overlay" onClick={onClose}>
            <div className="node-detail-content" onClick={(e) => e.stopPropagation()}>
                <div className="node-detail-header">
                    <div className={`node-type ${node.type}`}>
                        <i className={`fas fa-${node.type === 'question' ? 'question-circle' : 'lightbulb'}`}></i>
                        {node.type === 'question' ? '问题' : '回答'}
                    </div>
                    <button className="close-btn" onClick={onClose}>
                        <i className="fas fa-times"></i>
                    </button>
                </div>

                <div className="node-detail-body">
                    <RichContentRenderer
                        content={node.content}
                        nodeId={node.id}
                        onTextSelect={handleTextSelectFromDetail}
                    />

                    {node.tokens && (
                        <div className="token-info">
                            <div className="token-stats">
                                <span>输入令牌: <strong>{node.tokens.input}</strong></span>
                                <span>输出令牌: <strong>{node.tokens.output}</strong></span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="node-detail-footer">
                    <button className="back-btn" onClick={onClose}>
                        <i className="fas fa-arrow-left"></i>
                        返回流程图
                    </button>
                </div>
            </div>
        </div>
    );
};

// 智能文字截断函数，防止文字超出容器
const truncateText = (text, maxLength = 20, maxWidth = 160) => {
    if (!text) return '';

    // 清理HTML标签
    const cleanText = text.replace(/<[^>]*>/g, '').trim();

    // 如果文字很短，直接返回
    if (cleanText.length <= maxLength) {
        return cleanText;
    }

    // 估算文字宽度（中文字符通常比英文字符宽）
    const estimateWidth = (str) => {
        return str.split('').reduce((width, char) => {
            const code = char.charCodeAt(0);
            // 中文字符范围
            if (code >= 0x4e00 && code <= 0x9fff) {
                return width + 14; // 中文字符宽度
            } else if (code >= 0xff00 && code <= 0xffef) {
                return width + 12; // 全角字符宽度
            } else {
                return width + 7;  // 英文字符宽度
            }
        }, 0);
    };

    // 尝试找到合适的截断点
    let truncated = cleanText;
    while (estimateWidth(truncated) > maxWidth && truncated.length > 0) {
        truncated = truncated.substring(0, truncated.length - 1);
    }

    // 如果截断后太短，使用最小长度截断
    if (truncated.length < 8) {
        truncated = cleanText.substring(0, Math.min(8, cleanText.length));
    }

    // 添加省略号
    if (truncated.length < cleanText.length) {
        return truncated + '...';
    }

    return truncated;
};

// 渲染应用
ReactDOM.render(<App />, document.getElementById('root'));