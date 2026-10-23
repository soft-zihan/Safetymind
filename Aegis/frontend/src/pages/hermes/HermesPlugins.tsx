import { useState, useEffect } from 'react'
import { Card, Table, Tag, Typography, Spin, Switch, Rate, message } from 'antd'
import { ApiOutlined } from '@ant-design/icons'
import { getHermesPlugins } from '../../lib/hermesApi'

const { Title } = Typography

export default function HermesPlugins() {
  const [plugins, setPlugins] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getHermesPlugins()
      .then((data) => setPlugins(Array.isArray(data) ? data : data.plugins || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '版本', dataIndex: 'version', key: 'version' },
    {
      title: '启用', dataIndex: 'enabled', key: 'enabled',
      render: (v: boolean, record: any) => (
        <Switch checked={v} size="small" onChange={() => message.info(`插件 ${record.name} 状态切换（演示）`)} />
      ),
    },
    {
      title: '安全评级', dataIndex: 'safety_rating', key: 'safety_rating',
      render: (r: number) => <Rate disabled defaultValue={r} count={5} style={{ fontSize: 14 }} />,
    },
    {
      title: '类型', dataIndex: 'type', key: 'type',
      render: (t: string) => <Tag color="blue">{t}</Tag>,
    },
    {
      title: '来源', dataIndex: 'source', key: 'source',
      render: (s: string) => <Tag>{s || '本地'}</Tag>,
    },
  ]

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />

  return (
    <div>
      <Title level={4}><ApiOutlined /> Hermes 插件管理</Title>
      <Card>
        <Table dataSource={plugins} columns={columns} rowKey="name" pagination={false} />
      </Card>
    </div>
  )
}
