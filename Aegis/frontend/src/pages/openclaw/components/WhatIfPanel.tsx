import { useState, useEffect } from 'react'
import { Card, Switch, Space, Typography, Alert, Button, message, Spin, Tag, Divider } from 'antd'
import { SettingOutlined, ReloadOutlined } from '@ant-design/icons'
import axios from 'axios'

const { Text } = Typography

const LAYERS = [
  { id: 'L1_clawshell', name: 'ClawShell 代理层', icon: '🔒', requiresRestart: false },
  { id: 'L2_qise', name: 'qise 守卫层', icon: '🛡️', requiresRestart: false },
  { id: 'L3_openclaw', name: 'OpenClaw 加固层', icon: '🦞', requiresRestart: true },
  { id: 'L4_clawkeeper', name: 'ClawKeeper 防护层', icon: '🔗', requiresRestart: false },
  { id: 'L5_docker', name: 'Docker 沙箱层', icon: '🐳', requiresRestart: true },
]

interface WhatIfPanelProps {
  scenarioId: number
  onRetest?: () => void
  onDefenseChange?: (layerId: string, enabled: boolean) => void
}

function WhatIfPanel({ onRetest, onDefenseChange }: WhatIfPanelProps) {
  const [defenseStatus, setDefenseStatus] = useState<Record<string, boolean>>({
    L1_clawshell: true,
    L2_qise: true,
    L3_openclaw: true,
    L4_clawkeeper: true,
    L5_docker: true,
  })
  const [loading, setLoading] = useState(false)
  const [retesting, setRetesting] = useState(false)

  useEffect(() => {
    fetchDefenseStatus()
  }, [])

  const fetchDefenseStatus = async () => {
    try {
      const res = await axios.get('/api/demos/defense-status')
      setDefenseStatus(res.data.status)
    } catch (error) {
      console.error('获取防御状态失败:', error)
    }
  }

  const handleToggle = async (layerId: string, enabled: boolean) => {
    setLoading(true)
    try {
      const res = await axios.post('/api/demos/defense-toggle', {
        layer: layerId,
        enabled,
      })

      if (res.data.requires_restart) {
        message.warning(`${layerId} 需要重启 Gateway 才能生效`)
      } else {
        message.success(res.data.message)
      }

      const newStatus = { ...defenseStatus, [layerId]: enabled }
      setDefenseStatus(newStatus)
      
      // 通知父组件防御状态变化
      onDefenseChange?.(layerId, enabled)

      // 如果是即时生效的层，自动重新测试
      if (!res.data.requires_restart && onRetest) {
        setRetesting(true)
        await onRetest()
        setRetesting(false)
      }
    } catch (error: any) {
      message.error(error.response?.data?.detail || '切换失败')
    } finally {
      setLoading(false)
    }
  }

  const handleRetest = async () => {
    if (!onRetest) return
    setRetesting(true)
    try {
      await onRetest()
      message.success('重新测试完成')
    } catch (error) {
      message.error('重新测试失败')
    } finally {
      setRetesting(false)
    }
  }

  const handleResetAll = async () => {
    setLoading(true)
    try {
      // 全部启用
      for (const layer of LAYERS) {
        await axios.post('/api/demos/defense-toggle', {
          layer: layer.id,
          enabled: true,
        })
      }
      const newStatus = Object.fromEntries(LAYERS.map(l => [l.id, true]))
      setDefenseStatus(newStatus)
      message.success('已重置所有防御层')
      onDefenseChange?.('', true) // 触发父组件刷新
    } catch (error) {
      message.error('重置失败')
    } finally {
      setLoading(false)
    }
  }

  // 分析关键防线
  const getCriticalLayers = (): string[] => {
    // 简化逻辑：返回即时切换且已启用的层
    return LAYERS.filter(l => !l.requiresRestart && defenseStatus[l.id]).map(l => l.name)
  }

  return (
    <Card
      title={
        <Space>
          <SettingOutlined />
          <span>What-If 推演</span>
          <Tag color="purple">真实配置切换</Tag>
        </Space>
      }
      style={{ marginTop: 16 }}
    >
      <Alert
        type="info"
        showIcon
        message="切换防御层开关后，将真实重新发送请求测试效果"
        description={
          <span>
            <Text type="secondary">
              L1/L2/L4 即时切换，L3/L5 需要重启 Gateway
            </Text>
          </span>
        }
        style={{ marginBottom: 16 }}
      />

      <Spin spinning={loading}>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          {LAYERS.map((layer) => (
            <div
              key={layer.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                background: defenseStatus[layer.id] ? '#f6ffed' : '#fff1f0',
                borderRadius: 8,
                border: `1px solid ${defenseStatus[layer.id] ? '#b7eb8f' : '#ffa39e'}`,
              }}
            >
              <Space>
                <span style={{ fontSize: 20 }}>{layer.icon}</span>
                <div>
                  <Text strong>{layer.name}</Text>
                  {layer.requiresRestart && (
                    <Tag color="orange" style={{ marginLeft: 8, fontSize: 11 }}>需重启</Tag>
                  )}
                </div>
              </Space>
              <Switch
                checked={defenseStatus[layer.id]}
                onChange={(checked) => handleToggle(layer.id, checked)}
                checkedChildren="启用"
                unCheckedChildren="关闭"
              />
            </div>
          ))}
        </Space>
      </Spin>

      <Divider />

      <Space>
        <Button
          type="primary"
          icon={<ReloadOutlined />}
          onClick={handleRetest}
          loading={retesting}
        >
          重新测试
        </Button>
        <Button onClick={handleResetAll} disabled={loading}>
          全部启用
        </Button>
      </Space>

      {retesting && (
        <Alert
          type="info"
          showIcon
          message="正在重新测试..."
          description="请稍候，正在向双 Agent 发送真实请求"
          style={{ marginTop: 16 }}
        />
      )}

      <Divider />

      <div>
        <Text type="secondary">当前启用的关键防线：</Text>
        <div style={{ marginTop: 8 }}>
          {getCriticalLayers().map((name) => (
            <Tag key={name} color="green" style={{ marginBottom: 4 }}>{name}</Tag>
          ))}
        </div>
      </div>
    </Card>
  )
}

export default WhatIfPanel
