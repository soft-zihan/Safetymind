import { Card, Row, Col, Typography, Divider, Tag, Space } from 'antd'
import {
  SafetyOutlined, LockOutlined, CloudOutlined, ThunderboltOutlined,
  RobotOutlined, DatabaseOutlined, CarOutlined,
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'

const { Title, Paragraph, Text } = Typography

export default function QuantumPrivacy() {
  // 威胁雷达图
  const getThreatRadarOption = () => ({
    tooltip: {},
    radar: {
      indicator: [
        { name: '数据泄露', max: 100 },
        { name: '未授权访问', max: 100 },
        { name: '中间人攻击', max: 100 },
        { name: '量子计算威胁', max: 100 },
        { name: '侧信道攻击', max: 100 },
        { name: '数据篡改', max: 100 },
      ],
      shape: 'circle',
      splitNumber: 5,
      axisName: { color: '#666', fontSize: 11 },
    },
    series: [{
      type: 'radar',
      data: [
        {
          value: [85, 78, 82, 90, 65, 72],
          name: '传统方案威胁等级',
          areaStyle: { color: 'rgba(255, 77, 79, 0.3)' },
          lineStyle: { color: '#ff4d4f' },
          itemStyle: { color: '#ff4d4f' },
        },
        {
          value: [15, 12, 18, 10, 20, 8],
          name: 'PQC防护后',
          areaStyle: { color: 'rgba(82, 196, 26, 0.3)' },
          lineStyle: { color: '#52c41a' },
          itemStyle: { color: '#52c41a' },
        },
      ],
    }],
    legend: { data: ['传统方案威胁等级', 'PQC防护后'], bottom: 0 },
  })

  // 车云数据传输架构图
  const getVehicleCloudOption = () => ({
    tooltip: { trigger: 'item' },
    series: [{
      type: 'graph',
      layout: 'none',
      symbolSize: 60,
      roam: false,
      label: { show: true, fontSize: 11, fontWeight: 'bold' },
      edgeSymbol: ['circle', 'arrow'],
      edgeSymbolSize: [4, 10],
      edgeLabel: { fontSize: 10 },
      data: [
        { name: '车载智能体', x: 50, y: 150, itemStyle: { color: '#1890ff' } },
        { name: '本地存储', x: 200, y: 150, itemStyle: { color: '#52c41a' } },
        { name: '云端智能体', x: 350, y: 150, itemStyle: { color: '#722ed1' } },
        { name: '加密存储', x: 500, y: 150, itemStyle: { color: '#faad14' } },
        { name: '安全隧道', x: 275, y: 250, itemStyle: { color: '#eb2f96' } },
      ],
      links: [
        { source: '车载智能体', target: '本地存储', label: { show: true, formatter: '本地加密' } },
        { source: '本地存储', target: '安全隧道', label: { show: true, formatter: 'PQC加密' } },
        { source: '安全隧道', target: '云端智能体', label: { show: true, formatter: '安全传输' } },
        { source: '云端智能体', target: '加密存储', label: { show: true, formatter: '加密存储' } },
      ],
      lineStyle: { color: '#999', width: 2, curveness: 0 },
    }],
  })

  return (
    <div>
      {/* 顶部标题 */}
      <Card style={{ marginBottom: 24, background: 'linear-gradient(135deg, #722ed1 0%, #1890ff 100%)' }}>
        <Row align="middle" gutter={24}>
          <Col>
            <RobotOutlined style={{ fontSize: 48, color: '#fff' }} />
          </Col>
          <Col flex="auto">
            <Title level={2} style={{ color: '#fff', margin: 0 }}>
              智能体用户隐私数据保护
            </Title>
            <Paragraph style={{ color: 'rgba(255,255,255,0.9)', margin: '8px 0 0 0', fontSize: 16 }}>
              使用后量子密码学（PQC）技术，保护车载智能体本地存储、云端智能体加密存储和车云数据传输安全
            </Paragraph>
          </Col>
        </Row>
      </Card>

      {/* 后量子密码学原理 */}
      <Card title="🔬 后量子密码学（PQC）核心原理" style={{ marginBottom: 24 }}>
        <Row gutter={24}>
          <Col span={12}>
            <Title level={5}>为什么需要后量子密码学？</Title>
            <Paragraph>
              <Text strong>量子计算威胁：</Text>传统公钥密码学（RSA、ECC）基于大数分解和离散对数问题的计算复杂性。
              然而，Shor 算法在量子计算机上可在多项式时间内解决这些问题，意味着一旦大规模量子计算机实现，
              当前广泛使用的加密算法将被彻底破解。
            </Paragraph>
            <Paragraph>
              <Text strong>"先存储，后解密"攻击：</Text>攻击者现在就可以截获并存储加密通信，等待量子计算机成熟后再解密。
              对于需要长期保密的敏感数据（如个人隐私、商业机密、国家安全信息），这种威胁已经迫在眉睫。
            </Paragraph>
            <Paragraph>
              <Text strong>NIST 标准化进程：</Text>美国国家标准与技术研究院（NIST）于 2024 年发布了首批后量子密码学标准：
              FIPS 203（Kyber 密钥封装）、FIPS 204（Dilithium 数字签名）、FIPS 205（SPHINCS+ 哈希签名）。
              这标志着 PQC 从理论研究进入工程实践阶段。
            </Paragraph>
          </Col>
          <Col span={12}>
            <Title level={5}>三大核心算法</Title>
            <Paragraph>
              <Text strong>CRYSTALS-Kyber（密钥封装）：</Text>基于格（Lattice）上的 Module-LWE（Learning With Errors）问题。
              密钥尺寸 1568 字节，密文尺寸 1568 字节。安全性归约到最坏情况下的格问题，即使量子计算机也无法高效求解。
              用于密钥交换和对称密钥的安全协商。
            </Paragraph>
            <Paragraph>
              <Text strong>CRYSTALS-Dilithium（数字签名）：</Text>基于格上的 Module-LWR（Learning With Rounding）问题。
              签名尺寸 2420 字节，验证速度快。用于身份认证、数据完整性验证和不可否认性。
              相比基于哈希的签名方案（如 SPHINCS+），Dilithium 在签名尺寸和验证速度上更优。
            </Paragraph>
            <Paragraph>
              <Text strong>混合加密模式：</Text>采用 X25519（传统椭圆曲线）+ Kyber768（后量子）的混合密钥封装机制。
              即使 Kyber 被攻破，X25519 仍可提供保护；反之，即使量子计算机破解 X25519，Kyber 仍能抵御攻击。
              这种双重保障确保在密码学过渡期的安全性。
            </Paragraph>
          </Col>
        </Row>
      </Card>

      {/* 三大核心场景 */}
      <Row gutter={24} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card
            style={{ height: '100%', borderLeft: '4px solid #1890ff' }}
            title={
              <Space>
                <CarOutlined style={{ color: '#1890ff', fontSize: 20 }} />
                <span>车载智能体用户隐私数据本地存储</span>
              </Space>
            }
          >
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <SafetyOutlined style={{ fontSize: 64, color: '#1890ff' }} />
            </div>
            <Paragraph style={{ fontSize: 14, textAlign: 'center', marginBottom: 16 }}>
              车载智能体在本地存储用户隐私数据，使用<Text strong style={{ color: '#1890ff' }}>硬件级加密</Text>保护
            </Paragraph>
            <div style={{ background: '#e6f7ff', padding: 12, borderRadius: 8, textAlign: 'center', marginBottom: 12 }}>
              <Text strong style={{ color: '#1890ff', fontSize: 14 }}>
                🔒 本地数据不出车
              </Text>
            </div>
            <Divider style={{ margin: '12px 0' }} />
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>TEE安全环境</Text>
                <Tag color="blue">硬件隔离</Tag>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>AES-256加密</Text>
                <Tag color="blue">对称加密</Tag>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>密钥安全存储</Text>
                <Tag color="blue">HSM模块</Tag>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>访问控制</Text>
                <Tag color="blue">生物认证</Tag>
              </div>
            </Space>
          </Card>
        </Col>
        <Col span={8}>
          <Card
            style={{ height: '100%', borderLeft: '4px solid #52c41a' }}
            title={
              <Space>
                <DatabaseOutlined style={{ color: '#52c41a', fontSize: 20 }} />
                <span>云端智能体用户隐私数据加密存储</span>
              </Space>
            }
          >
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <LockOutlined style={{ fontSize: 64, color: '#52c41a' }} />
            </div>
            <Paragraph style={{ fontSize: 14, textAlign: 'center', marginBottom: 16 }}>
              云端智能体使用<Text strong style={{ color: '#52c41a' }}>抗量子加密</Text>保护用户隐私数据
            </Paragraph>
            <div style={{ background: '#f6ffed', padding: 12, borderRadius: 8, textAlign: 'center', marginBottom: 12 }}>
              <Text strong style={{ color: '#52c41a', fontSize: 14 }}>
                🔐 抵御量子计算威胁
              </Text>
            </div>
            <Divider style={{ margin: '12px 0' }} />
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>数据加密</Text>
                <Tag color="green">CRYSTALS-Kyber</Tag>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>密钥管理</Text>
                <Tag color="green">PQC-KMS</Tag>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>访问审计</Text>
                <Tag color="green">全链路追踪</Tag>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>数据隔离</Text>
                <Tag color="green">多租户隔离</Tag>
              </div>
            </Space>
          </Card>
        </Col>
        <Col span={8}>
          <Card
            style={{ height: '100%', borderLeft: '4px solid #722ed1' }}
            title={
              <Space>
                <CloudOutlined style={{ color: '#722ed1', fontSize: 20 }} />
                <span>车云数据传输</span>
              </Space>
            }
          >
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <ThunderboltOutlined style={{ fontSize: 64, color: '#722ed1' }} />
            </div>
            <Paragraph style={{ fontSize: 14, textAlign: 'center', marginBottom: 16 }}>
              车云数据传输使用<Text strong style={{ color: '#722ed1' }}>PQC-TLS</Text>加密隧道保护
            </Paragraph>
            <div style={{ background: '#f9f0ff', padding: 12, borderRadius: 8, textAlign: 'center', marginBottom: 12 }}>
              <Text strong style={{ color: '#722ed1', fontSize: 14 }}>
                ⚡ 抗量子安全隧道
              </Text>
            </div>
            <Divider style={{ margin: '12px 0' }} />
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>传输加密</Text>
                <Tag color="purple">PQC-TLS 1.3</Tag>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>密钥交换</Text>
                <Tag color="purple">Kyber-1024</Tag>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>身份认证</Text>
                <Tag color="purple">Dilithium签名</Tag>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>前向保密</Text>
                <Tag color="purple">PFS</Tag>
              </div>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* 威胁分析 */}
      <Row gutter={24} style={{ marginBottom: 24 }}>
        <Col span={12}>
          <Card title="🎯 隐私数据威胁等级对比">
            <ReactECharts option={getThreatRadarOption()} style={{ height: 350 }} />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="🔬 后量子密码算法应用">
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div style={{ padding: '12px', background: '#e6f7ff', borderRadius: 8, borderLeft: '3px solid #1890ff' }}>
                <Text strong>AES-256 + HSM</Text>
                <br />
                <Text type="secondary">车载本地数据加密，硬件级密钥保护</Text>
              </div>
              <div style={{ padding: '12px', background: '#f6ffed', borderRadius: 8, borderLeft: '3px solid #52c41a' }}>
                <Text strong>CRYSTALS-Kyber</Text>
                <br />
                <Text type="secondary">云端数据加密存储，抗量子密钥封装</Text>
              </div>
              <div style={{ padding: '12px', background: '#f9f0ff', borderRadius: 8, borderLeft: '3px solid #722ed1' }}>
                <Text strong>Dilithium</Text>
                <br />
                <Text type="secondary">车云通信身份认证，数字签名验证</Text>
              </div>
              <div style={{ padding: '12px', background: '#fff7e6', borderRadius: 8, borderLeft: '3px solid #faad14' }}>
                <Text strong>PQC-TLS 1.3</Text>
                <br />
                <Text type="secondary">车云数据传输加密，抗量子安全隧道</Text>
              </div>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* 车云数据传输架构 */}
      <Card title="🚗 车云数据传输安全架构" style={{ marginBottom: 24 }}>
        <ReactECharts option={getVehicleCloudOption()} style={{ height: 300 }} />
        <Divider />
        <Row gutter={24}>
          <Col span={8}>
            <Card size="small" title="📡 车载端安全">
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <Text>• TEE安全环境处理</Text>
                <Text>• 本地数据AES-256加密</Text>
                <Text>• HSM密钥安全存储</Text>
                <Text>• 生物认证访问控制</Text>
              </Space>
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small" title="🔐 传输链路安全">
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <Text>• PQC-TLS 1.3加密隧道</Text>
                <Text>• Kyber-1024密钥交换</Text>
                <Text>• Dilithium身份认证</Text>
                <Text>• 完美前向保密(PFS)</Text>
              </Space>
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small" title="☁️ 云端安全">
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <Text>• CRYSTALS-Kyber加密存储</Text>
                <Text>• PQC-KMS密钥管理</Text>
                <Text>• 多租户数据隔离</Text>
                <Text>• 全链路访问审计</Text>
              </Space>
            </Card>
          </Col>
        </Row>
      </Card>

      {/* 技术实现细节 */}
      <Row gutter={24}>
        <Col span={8}>
          <Card title="🔒 车载本地存储技术" size="small">
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <div style={{ padding: '8px 12px', background: '#f5f5f5', borderRadius: 4 }}>
                <Text strong>TEE可信执行环境</Text>
                <br />
                <Text type="secondary">硬件隔离的安全区域处理敏感数据</Text>
              </div>
              <div style={{ padding: '8px 12px', background: '#f5f5f5', borderRadius: 4 }}>
                <Text strong>HSM硬件安全模块</Text>
                <br />
                <Text type="secondary">密钥物理隔离存储，防篡改</Text>
              </div>
              <div style={{ padding: '8px 12px', background: '#f5f5f5', borderRadius: 4 }}>
                <Text strong>AES-256对称加密</Text>
                <br />
                <Text type="secondary">高效加密本地用户隐私数据</Text>
              </div>
            </Space>
          </Card>
        </Col>
        <Col span={8}>
          <Card title="🔐 云端加密存储技术" size="small">
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <div style={{ padding: '8px 12px', background: '#f5f5f5', borderRadius: 4 }}>
                <Text strong>CRYSTALS-Kyber</Text>
                <br />
                <Text type="secondary">抗量子密钥封装，保护云端数据</Text>
              </div>
              <div style={{ padding: '8px 12px', background: '#f5f5f5', borderRadius: 4 }}>
                <Text strong>PQC-KMS密钥管理</Text>
                <br />
                <Text type="secondary">后量子安全密钥生命周期管理</Text>
              </div>
              <div style={{ padding: '8px 12px', background: '#f5f5f5', borderRadius: 4 }}>
                <Text strong>多租户隔离</Text>
                <br />
                <Text type="secondary">用户数据逻辑隔离，防止越权访问</Text>
              </div>
            </Space>
          </Card>
        </Col>
        <Col span={8}>
          <Card title="🚙 车云传输安全技术" size="small">
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <div style={{ padding: '8px 12px', background: '#f5f5f5', borderRadius: 4 }}>
                <Text strong>PQC-TLS 1.3</Text>
                <br />
                <Text type="secondary">抗量子安全传输协议</Text>
              </div>
              <div style={{ padding: '8px 12px', background: '#f5f5f5', borderRadius: 4 }}>
                <Text strong>Dilithium签名</Text>
                <br />
                <Text type="secondary">车云双向身份认证</Text>
              </div>
              <div style={{ padding: '8px 12px', background: '#f5f5f5', borderRadius: 4 }}>
                <Text strong>完美前向保密</Text>
                <br />
                <Text type="secondary">单次会话密钥，泄露不影响历史</Text>
              </div>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
