import { useState, useEffect } from 'react'
import { Card, Typography, Spin, Alert, Tag, List, Empty, Space } from 'antd'
import { FolderOutlined, FileOutlined } from '@ant-design/icons'
import axios from 'axios'

const { Title, Text, Paragraph } = Typography

const api = axios.create({ baseURL: '/api/hermes/upstream', timeout: 10000 })

interface FileInfo {
  name: string
  type: 'dir' | 'file'
}

interface ProjectDetail {
  key: string
  name: string
  description: string
  category: string
  exists: boolean
  path?: string
  files?: FileInfo[]
  message?: string
}

interface Props {
  projectKey: string
  title: string
}

export default function HermesUpstreamProject({ projectKey, title }: Props) {
  const [detail, setDetail] = useState<ProjectDetail | null>(null)
  const [readme, setReadme] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [projectKey])

  const loadData = async () => {
    setLoading(true)
    try {
      const [detailRes, readmeRes] = await Promise.all([
        api.get(`/${projectKey}`),
        api.get(`/${projectKey}/readme`),
      ])
      setDetail(detailRes.data)
      setReadme(readmeRes.data.content || '')
    } catch {
      setDetail(null)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />
  }

  if (!detail) {
    return (
      <Alert
        message="项目未找到"
        description={`无法找到 ${projectKey} 项目，请检查目录是否存在`}
        type="error"
        showIcon
      />
    )
  }

  if (!detail.exists) {
    return (
      <div>
        <Title level={4}>{title}</Title>
        <Alert
          message="项目目录不存在"
          description={detail.message || `请确保 ${projectKey} 已克隆到 hermes/ 目录`}
          type="warning"
          showIcon
        />
      </div>
    )
  }

  return (
    <div>
      <Title level={4}>{title}</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        {detail.description}
      </Text>

      <div style={{ marginBottom: 16 }}>
        <Tag color="blue">{detail.category}</Tag>
        {detail.path && <Text type="secondary">路径: {detail.path}</Text>}
      </div>

      {/* 文件结构 */}
      <Card title="项目结构" style={{ marginBottom: 24 }}>
        {detail.files && detail.files.length > 0 ? (
          <List
            size="small"
            dataSource={detail.files}
            renderItem={(item) => (
              <List.Item>
                <Space>
                  {item.type === 'dir' ? (
                    <FolderOutlined style={{ color: '#1890ff' }} />
                  ) : (
                    <FileOutlined style={{ color: '#8c8c8c' }} />
                  )}
                  <Text>{item.name}</Text>
                </Space>
              </List.Item>
            )}
          />
        ) : (
          <Empty description="无文件" />
        )}
      </Card>

      {/* README */}
      {readme && (
        <Card title="README">
          <Paragraph>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 13, maxHeight: 500, overflow: 'auto' }}>
              {readme.slice(0, 5000)}
              {readme.length > 5000 && '\n\n... (内容过长，已截断)'}
            </pre>
          </Paragraph>
        </Card>
      )}
    </div>
  )
}
