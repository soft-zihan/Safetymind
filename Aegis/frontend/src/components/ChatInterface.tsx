import { useState, useRef, useEffect } from 'react'
import { Card, Input, Button, List, Avatar, Tag, Space, Spin, Alert } from 'antd'
import { SendOutlined, RobotOutlined, UserOutlined, DeleteOutlined } from '@ant-design/icons'
import axios from 'axios'

const { TextArea } = Input

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
}

interface ChatInterfaceProps {
  apiUrl: string
  agentName: string
  agentPort: number
  agentStatus?: 'online' | 'offline' | 'error'
}

export default function ChatInterface({ apiUrl, agentName, agentPort, agentStatus = 'online' }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 发送消息
  const sendMessage = async () => {
    if (!input.trim() || loading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)
    setError(null)

    try {
      // 调用后端 API 转发到 Agent
      const response = await axios.post('/api/agent/chat', {
        message: userMessage.content,
        agent_url: apiUrl,
        agent_port: agentPort,
      }, {
        timeout: 60000, // 60 秒超时
      })

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.data.response || response.data.message || '无回复',
        timestamp: new Date(),
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (err: any) {
      console.error('发送消息失败:', err)
      setError(err.response?.data?.detail || err.message || '发送失败，请检查 Agent 是否在线')
      
      // 添加错误提示消息
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'system',
        content: `❌ ${err.response?.data?.detail || err.message || '发送失败'}`,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  // 清空聊天记录
  const clearChat = () => {
    setMessages([])
    setError(null)
  }

  // 按 Enter 发送（Shift+Enter 换行）
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <Card
      title={
        <Space>
          <RobotOutlined />
          <span>{agentName} (端口 {agentPort})</span>
          <Tag color={agentStatus === 'online' ? 'green' : agentStatus === 'offline' ? 'default' : 'red'}>
            {agentStatus === 'online' ? '在线' : agentStatus === 'offline' ? '离线' : '错误'}
          </Tag>
        </Space>
      }
      extra={
        <Button
          size="small"
          icon={<DeleteOutlined />}
          onClick={clearChat}
          disabled={messages.length === 0}
        >
          清空
        </Button>
      }
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
      bodyStyle={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}
    >
      {/* 错误提示 */}
      {error && (
        <Alert
          message="通信错误"
          description={error}
          type="error"
          showIcon
          closable
          onClose={() => setError(null)}
          style={{ marginBottom: 12 }}
        />
      )}

      {/* 消息列表 */}
      <div style={{ flex: 1, overflow: 'auto', marginBottom: 16 }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
            <RobotOutlined style={{ fontSize: 48, marginBottom: 12 }} />
            <div>开始与 {agentName} 对话</div>
            <div style={{ fontSize: 12, marginTop: 8 }}>支持发送文本消息进行实时对话</div>
          </div>
        ) : (
          <List
            dataSource={messages}
            renderItem={(msg) => (
              <List.Item
                style={{
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  border: 'none',
                  padding: '4px 0',
                }}
              >
                <Space align="start" style={{ maxWidth: '80%' }}>
                  {msg.role !== 'user' && (
                    <Avatar
                      icon={msg.role === 'assistant' ? <RobotOutlined /> : <RobotOutlined />}
                      style={{ backgroundColor: msg.role === 'assistant' ? '#1890ff' : '#faad14' }}
                      size="small"
                    />
                  )}
                  <div
                    style={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: msg.role === 'user' ? '#1890ff' : msg.role === 'assistant' ? '#f0f0f0' : '#fff1f0',
                      color: msg.role === 'user' ? '#fff' : '#000',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    <div style={{ fontSize: 14 }}>{msg.content}</div>
                    <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4, textAlign: msg.role === 'user' ? 'right' : 'left' }}>
                      {msg.timestamp.toLocaleTimeString('zh-CN')}
                    </div>
                  </div>
                  {msg.role === 'user' && (
                    <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#87d068' }} size="small" />
                  )}
                </Space>
              </List.Item>
            )}
          />
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 输入区域 */}
      <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 12 }}>
        <Space.Compact style={{ width: '100%' }}>
          <TextArea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="输入消息... (Enter 发送，Shift+Enter 换行)"
            autoSize={{ minRows: 1, maxRows: 4 }}
            disabled={loading || agentStatus !== 'online'}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={sendMessage}
            loading={loading}
            disabled={!input.trim() || agentStatus !== 'online'}
          >
            发送
          </Button>
        </Space.Compact>
        {loading && (
          <div style={{ marginTop: 8, textAlign: 'center', color: '#999', fontSize: 12 }}>
            <Spin size="small" style={{ marginRight: 8 }} />
            Agent 正在回复...
          </div>
        )}
      </div>
    </Card>
  )
}
