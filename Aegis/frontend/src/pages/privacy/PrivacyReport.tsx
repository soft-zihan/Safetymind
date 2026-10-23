/**
 * AI-SAFE Privacy — 隐私合规仪表盘（虚拟数据占位页）
 */
import { useState } from 'react'
import { Card, Row, Col, Table, Tag, Typography, Steps, Alert } from 'antd'
import {
  SafetyCertificateOutlined,
  LockOutlined,
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'

const { Title, Paragraph, Text } = Typography

const recentAudits = [
  { key: '1', agent: 'Carmind Agent', dataType: '位置数据', action: '读取', result: '已授权', time: '*', token: '0x7a3f...e91b' },
  { key: '2', agent: '第三方导航 Agent', dataType: '通讯录', action: '读取', result: '已拒绝', time: '*', token: '0x2c8d...a44f' },
  { key: '3', agent: 'Carmind Agent', dataType: 'Carmind Memory', action: '写入', result: '已授权', time: '*', token: '0x9e1b...c73d' },
  { key: '4', agent: '云端模型', dataType: '语音数据', action: '处理', result: '已脱敏', time: '*', token: '0x4f5a...b82e' },
  { key: '5', agent: 'Carmind Agent', dataType: '车辆数据', action: '读取', result: '已授权', time: '*', token: '0x1d6c...f05a' },
  { key: '6', agent: '第三方保险 Agent', dataType: '驾驶行为', action: '读取', result: '已拒绝', time: '*', token: '0x8b3e...d27c' },
]

const dataCategories = [
  { category: 'Camera（摄像头）', status: 'protected' },
  { category: 'Mic（麦克风）', status: 'protected' },
  { category: 'Location（位置）', status: 'protected' },
]

const roadmapSteps = [
  { title: 'Privacy Probe', subtitle: '看得见', status: 'finish', desc: 'AI 安心状态 / 安心记录 / 隐私锁' },
  { title: 'Privacy Context Broker', subtitle: '管得住', status: 'process', desc: 'Agent 身份 × 用途 × 数据类型授权 / Context 最小披露' },
  { title: 'Privacy Control Plane', subtitle: '持续治理', status: 'wait', desc: '多车型多地域 Profile / 区域化合规' },
]

export default function PrivacyReport() {
  const [activeStep, setActiveStep] = useState(1)

  const radarOption = {
    tooltip: {},
    radar: {
      indicator: [
        { name: '授权覆盖', max: 100 },
        { name: '可追溯率', max: 100 },
        { name: '撤销成功率', max: 100 },
        { name: '安全传输', max: 100 },
        { name: '脱敏覆盖', max: 100 },
        { name: '最小化披露', max: 100 },
      ],
      shape: 'circle',
      splitArea: { areaStyle: { color: ['#fff', '#f6ffed', '#fff', '#f6ffed'] } },
    },
    series: [{
      type: 'radar',
      data: [
        {
          value: [87, 92, 95, 78, 85, 72],
          name: '当前合规评分',
          areaStyle: { color: 'rgba(82, 196, 26, 0.15)' },
          lineStyle: { color: '#52c41a', width: 2 },
          itemStyle: { color: '#52c41a' },
        },
        {
          value: [100, 100, 100, 100, 100, 100],
          name: '目标值',
          lineStyle: { color: '#1890ff', type: 'dashed', width: 1 },
          itemStyle: { color: '#1890ff' },
          areaStyle: { color: 'rgba(24, 144, 255, 0.05)' },
        },
      ],
    }],
    legend: { data: ['当前合规评分', '目标值'], bottom: 0 },
  }

  const auditColumns = [
    { title: '时间', dataIndex: 'time', key: 'time', width: 180 },
    { title: 'Agent', dataIndex: 'agent', key: 'agent', width: 160 },
    { title: '数据类型', dataIndex: 'dataType', key: 'dataType', width: 140 },
    { title: '操作', dataIndex: 'action', key: 'action', width: 80 },
    {
      title: '结果', dataIndex: 'result', key: 'result', width: 100,
      render: (v: string) => {
        const colors: Record<string, string> = { '已授权': 'green', '已拒绝': 'red', '已脱敏': 'orange' }
        return <Tag color={colors[v] || 'default'}>{v}</Tag>
      },
    },
    { title: 'Trace Token', dataIndex: 'token', key: 'token', width: 140, render: (v: string) => <Text code style={{ fontSize: 12 }}>{v}</Text> },
  ]

  const dataColumns = [
    { title: '数据类别', dataIndex: 'category', key: 'category' },
    {
      title: '保护状态', dataIndex: 'status', key: 'status',
      render: (v: string) => v === 'protected'
        ? <Tag color="green" icon={<SafetyCertificateOutlined />}>已保护</Tag>
        : <Tag color="red" icon={<LockOutlined />}>已锁定</Tag>,
    },
  ]

  return (
    <div>
      {/* 顶部标题 */}
      <Card style={{ marginBottom: 24, background: 'linear-gradient(135deg, #52c41a 0%, #13c2c2 100%)' }}>
        <Row align="middle" gutter={24}>
          <Col>
            <SafetyCertificateOutlined style={{ fontSize: 48, color: '#fff' }} />
          </Col>
          <Col flex="auto">
            <Title level={2} style={{ color: '#fff', margin: 0 }}>
              AI-SAFE Privacy — 隐私合规仪表盘
            </Title>
            <Paragraph style={{ color: 'rgba(255,255,255,0.9)', margin: '8px 0 0 0', fontSize: 16 }}>
              以"隐私仪表盘"建立用户可感知的数据边界 — 看得见 · 锁得住 · 查得到
            </Paragraph>
          </Col>
        </Row>
      </Card>

      {/* 核心机制说明 */}
      <Card title="🔐 隐私保护核心机制" style={{ marginBottom: 24 }}>
        <Row gutter={24}>
          <Col span={8}>
            <Title level={5}>Privacy Probe（看得见）</Title>
            <Paragraph>
              <Text strong>实时状态指示：</Text>在座舱界面显示 AI 当前状态（监听中/记录中/已关闭），
              让用户随时掌握隐私数据是否被采集。
            </Paragraph>
            <Paragraph>
              <Text strong>安心记录：</Text>用户可随时查看历史隐私事件，了解哪些数据被访问、
              何时访问、用于何种目的，形成完整的隐私审计轨迹。
            </Paragraph>
            <Paragraph>
              <Text strong>隐私锁：</Text>一键关闭所有隐私数据采集，物理级切断麦克风、
              摄像头、位置等传感器的数据流。
            </Paragraph>
          </Col>
          <Col span={8}>
            <Title level={5}>Privacy Context Broker（管得住）</Title>
            <Paragraph>
              <Text strong>多维授权模型：</Text>基于 Agent 身份 × 用途 × 数据类型 的三维授权矩阵，
              实现细粒度的数据访问控制。例如：导航 Agent 可访问位置数据，但不可访问通讯录。
            </Paragraph>
            <Paragraph>
              <Text strong>Context 最小披露：</Text>根据当前任务需求，仅向 AI 披露必要的上下文信息，
              避免过度暴露用户隐私。通过意图识别动态调整信息披露范围。
            </Paragraph>
            <Paragraph>
              <Text strong>动态脱敏：</Text>对敏感数据（如身份证号、银行卡号）进行实时脱敏处理，
              确保 AI 只能看到必要的信息片段。
            </Paragraph>
          </Col>
          <Col span={8}>
            <Title level={5}>Privacy Control Plane（持续治理）</Title>
            <Paragraph>
              <Text strong>多车型多地域 Profile：</Text>支持不同车型、不同地区的隐私合规策略配置，
              满足 GDPR、CCPA、中国《个人信息保护法》等法规要求。
            </Paragraph>
            <Paragraph>
              <Text strong>区域化合规：</Text>根据车辆所在位置自动切换合规策略，
              例如进入欧盟区域自动启用 GDPR 模式，限制跨境数据传输。
            </Paragraph>
            <Paragraph>
              <Text strong>审计与追溯：</Text>完整的隐私事件审计日志，支持 90 天回溯查询，
              每条记录包含 Trace Token 用于全链路追踪。
            </Paragraph>
          </Col>
        </Row>
      </Card>

      {/* Privacy 能力演进路线 — 放顶部 */}
      <Card title="Privacy 能力演进路线" style={{ marginBottom: 24 }}>
        <Steps
          current={activeStep}
          onChange={setActiveStep}
          items={roadmapSteps.map(s => ({
            title: s.title,
            description: s.subtitle,
          }))}
          style={{ marginBottom: 24 }}
        />
        <Alert
          message={roadmapSteps[activeStep].title + ' — ' + roadmapSteps[activeStep].subtitle}
          description={roadmapSteps[activeStep].desc}
          type={activeStep === 0 ? 'success' : activeStep === 1 ? 'info' : 'warning'}
          showIcon
        />
      </Card>

      {/* 隐私雷达图 + 座舱数据资产 */}
      <Row gutter={24} style={{ marginBottom: 24 }}>
        <Col span={10}>
          <Card title="隐私雷达图">
            <ReactECharts option={radarOption} style={{ height: 320 }} />
          </Card>
        </Col>
        <Col span={14}>
          <Card title="座舱数据资产保护状态">
            <Table
              dataSource={dataCategories}
              columns={dataColumns}
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>

      {/* 访问审计日志 */}
      <Card title="实时访问审计日志">
        <Table
          dataSource={recentAudits}
          columns={auditColumns}
          pagination={{ pageSize: 5 }}
          size="small"
        />
      </Card>
    </div>
  )
}
