import { useState, useEffect } from 'react';
import { Card, Table, Button, Popconfirm, Tag, Alert, Row, Col, Statistic, Space } from 'antd';
import { SaveOutlined, RollbackOutlined, DeleteOutlined } from '@ant-design/icons';
import { getBackups, restoreBackup } from '../../lib/qiseApi';

export default function BackupRestore() {
  const [backups, setBackups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadBackups(); }, []);

  const loadBackups = async () => {
    try {
      const data = await getBackups();
      if (Array.isArray(data)) { setBackups(data); }
    } catch {
      // 后端未连接，保持空列表
    }
    finally { setLoading(false); }
  };

  const handleRestore = async (id: string) => {
    try { await restoreBackup(id); loadBackups(); } catch {}
  };

  const typeColor: Record<string, string> = { '自动备份': 'blue', '保护前备份': 'green', '手动备份': 'orange', '检测时备份': 'default' };

  return (
    <div>
      {backups.length === 0 && !loading && <Alert message="暂无备份记录" description="后端未连接或无备份数据。" type="info" showIcon style={{ marginBottom: 16 }} />}

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card size="small"><Statistic title="总备份数" value={backups.length} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="金刚龙虾" value={backups.filter(b => b.agent.includes('金刚')).length} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="裸奔龙虾" value={backups.filter(b => b.agent.includes('裸奔')).length} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="最近备份" value="1 小时前" /></Card></Col>
      </Row>

      <Card title="💾 备份管理"
        extra={<Button type="primary" icon={<SaveOutlined />}>立即备份</Button>}>
        <Table dataSource={backups} loading={loading} rowKey="id" pagination={{ pageSize: 8 }} size="small"
          columns={[
            { title: '智能体', dataIndex: 'agent', key: 'agent', render: (a: string) => <Tag color={a.includes('金刚') ? 'green' : a.includes('裸奔') ? 'orange' : 'default'}>{a}</Tag> },
            { title: '类型', dataIndex: 'type', key: 'type', render: (t: string) => <Tag color={typeColor[t] || 'default'}>{t}</Tag> },
            { title: '备份时间', dataIndex: 'backup_time', key: 'time', render: (t: string) => new Date(t).toLocaleString('zh-CN') },
            { title: '大小', dataIndex: 'size', key: 'size' },
            { title: '路径', dataIndex: 'path', key: 'path', render: (p: string) => <span style={{ color: '#666', fontSize: 12 }}>{p}</span> },
            {
              title: '操作', key: 'action', width: 160,
              render: (_: any, record: any) => (
                <Space>
                  <Popconfirm title="确认恢复此备份？将覆盖当前配置。" onConfirm={() => handleRestore(record.id)}>
                    <Button size="small" icon={<RollbackOutlined />}>恢复</Button>
                  </Popconfirm>
                  <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
                </Space>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
