import { useState, useEffect } from 'react'
import { Image, Empty, Spin, Typography, Card } from 'antd'
import { PictureOutlined } from '@ant-design/icons'

const { Text } = Typography

interface PPTGalleryProps {
  directory: string
  title?: string
}

interface FileInfo {
  name: string
  path: string
  type: 'image' | 'unknown'
}

export default function PPTGallery({ directory, title }: PPTGalleryProps) {
  const [files, setFiles] = useState<FileInfo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const res = await fetch(`/api/ppts/${directory}`)
        if (res.ok) {
          const data = await res.json()
          setFiles((data.files || []).filter((f: FileInfo) => f.type === 'image'))
        }
      } catch (err) {
        console.error('Failed to fetch files:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchFiles()
  }, [directory])

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>
          <Text type="secondary">加载中...</Text>
        </div>
      </div>
    )
  }

  if (files.length === 0) {
    return (
      <Card>
        <Empty
          image={<PictureOutlined style={{ fontSize: 64, color: '#d9d9d9' }} />}
          description={
            <span>
              暂无内容<br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                请将图片文件放入 public/ppts/{directory}/ 目录
              </Text>
            </span>
          }
        />
      </Card>
    )
  }

  return (
    <div>
      {title && (
        <div style={{ marginBottom: 24 }}>
          <Text strong style={{ fontSize: 16 }}>{title}</Text>
          <Text type="secondary" style={{ marginLeft: 12 }}>共 {files.length} 页</Text>
        </div>
      )}
      <Image.PreviewGroup>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {files.map((file, index) => (
            <div
              key={index}
              style={{
                background: '#000',
                borderRadius: 8,
                overflow: 'hidden',
                boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
              }}
            >
              <Image
                src={file.path}
                alt={file.name}
                style={{ width: '100%', height: 'auto', display: 'block' }}
                fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN88P/BfwAJhAPk2rNzjQAAAABJRU5ErkJggg=="
              />
              <div style={{
                padding: '6px 12px',
                background: 'rgba(0,0,0,0.7)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
                  {file.name}
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
                  {index + 1} / {files.length}
                </Text>
              </div>
            </div>
          ))}
        </div>
      </Image.PreviewGroup>
    </div>
  )
}
