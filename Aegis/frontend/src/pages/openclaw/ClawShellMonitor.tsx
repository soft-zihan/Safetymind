import { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Spin, Alert, Tag, Typography } from 'antd';
import { 
  SafetyOutlined, 
  KeyOutlined, 
  MailOutlined, 
  BarChartOutlined 
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { clawshellService } from '../../services/clawshell';

const { Title, Paragraph, Text } = Typography;

interface StatsData {
  total_requests: number;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  total_tokens: number;
  emails_hidden: number;
  filtered_addresses: Record<string, number>;
}

const ClawShellMonitor = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    fetchStats();
    // 每 30 秒刷新一次
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const data = await clawshellService.getStats();
      setStats(data.data || data);
      setIsRunning(true);
      setError(null);
    } catch (err: any) {
      setError(err.message || '无法连接到 ClawShell 服务');
      setIsRunning(false);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !stats) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" tip="加载监控数据..." />
      </div>
    );
  }

  if (error && !stats) {
    return (
      <Alert
        message="服务未连接"
        description={error}
        type="error"
        showIcon
        action={
          <button onClick={fetchStats} style={{ cursor: 'pointer' }}>
            重试
          </button>
        }
      />
    );
  }

  // ECharts 配置
  const getChartOption = () => {
    if (!stats) return {};
    
    return {
      title: {
        text: 'Token 使用统计',
        left: 'center',
      },
      tooltip: {
        trigger: 'item',
      },
      legend: {
        orient: 'vertical',
        left: 'left',
      },
      series: [
        {
          name: 'Token 类型',
          type: 'pie',
          radius: '50%',
          data: [
            { value: stats.total_prompt_tokens, name: 'Prompt Tokens' },
            { value: stats.total_completion_tokens, name: 'Completion Tokens' },
          ],
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)',
            },
          },
        },
      ],
    };
  };

  return (
    <div style={{ padding: '0 16px' }}>      {/* 功能原理说明 */}
      <Card style={{ marginBottom: 24, background: 'linear-gradient(135deg, #722ed1 0%, #2f54eb 100%)' }}>
        <Row align="middle" gutter={24}>
          <Col flex="auto">
            <Title level={3} style={{ color: '#fff', margin: 0 }}>
              ClawShell 安全代理 — 功能原理
            </Title>
            <Paragraph style={{ color: 'rgba(255,255,255,0.9)', margin: '8px 0 0 0', fontSize: 14 }}>
              Rust 实现的高性能安全代理层，拦截所有 LLM API 调用，提供密钥隔离、DLP 扫描、审计追踪
            </Paragraph>
          </Col>
        </Row>
      </Card>

      <Card title="🔐 核心机制" style={{ marginBottom: 24 }}>
        <Row gutter={24}>
          <Col span={12}>
            <Title level={5}>API 密钥隔离</Title>
            <Paragraph>
              <Text strong>虚拟密钥机制：</Text>智能体仅持有虚拟密钥（格式：sk-virt-{'<provider>'}-{'<fingerprint>'}），
              真实 API 密钥存储在 OS Keychain（macOS）/ systemd credentials（Linux）中，受 Unix 权限保护。
            </Paragraph>
            <Paragraph>
              <Text strong>密钥解析流程：</Text>代理层从请求头提取虚拟密钥 → 计算 SHA-256 指纹 → 
              遍历 Keychain 匹配 → 替换为真实密钥转发上游。虚拟密钥是真实密钥的不可逆指纹，即使泄露也无法还原。
            </Paragraph>
          </Col>
          <Col span={12}>
            <Title level={5}>DLP 扫描引擎</Title>
            <Paragraph>
              <Text strong>双向扫描：</Text>请求体和响应体都经过 DLP 引擎，基于正则模式库检测 PII 和敏感信息。
            </Paragraph>
            <Paragraph>
              <Text strong>内置规则：</Text>信用卡（Visa/Mastercard）、身份证号、手机号、邮箱、AWS Access Key、
              私钥块、IPv4 地址等 9 类规则。支持两种动作：Block（拒绝请求，返回 403）和 Redact（替换为 [REDACTED:rule_id]）。
            </Paragraph>
            <Paragraph>
              <Text strong>审计日志：</Text>所有请求记录到 SQLite，包含 provider、model、tokens、latency、DLP 匹配数等字段。
            </Paragraph>
          </Col>
        </Row>
      </Card>
      {/* 状态指示器 */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
        <Tag color={isRunning ? 'green' : 'red'} style={{ fontSize: 14, padding: '4px 12px' }}>
          {isRunning ? '● 运行中' : '● 已停止'}
        </Tag>
        <span style={{ color: '#666' }}>ClawShell 代理服务</span>
      </div>

      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="总请求数"
              value={stats?.total_requests || 0}
              prefix={<SafetyOutlined />}
              suffix="次"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Prompt Tokens"
              value={stats?.total_prompt_tokens || 0}
              prefix={<KeyOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Completion Tokens"
              value={stats?.total_completion_tokens || 0}
              prefix={<BarChartOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="邮件隐藏"
              value={stats?.emails_hidden || 0}
              prefix={<MailOutlined />}
              suffix="封"
            />
          </Card>
        </Col>
      </Row>

      {/* Token 使用图表 */}
      <Card title="Token 使用分布" style={{ marginBottom: 24 }}>
        <ReactECharts 
          option={getChartOption()} 
          style={{ height: '400px' }}
        />
      </Card>

      {/* 过滤地址统计 */}
      {stats?.filtered_addresses && Object.keys(stats.filtered_addresses).length > 0 && (
        <Card title="邮件过滤统计">
          <Row gutter={[16, 16]}>
            {Object.entries(stats.filtered_addresses)
              .sort((a, b) => (b[1] as number) - (a[1] as number))
              .slice(0, 10)
              .map(([address, count]) => (
                <Col span={12} key={address}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                    <span style={{ color: '#666' }}>{address}</span>
                    <Tag color="blue">{count} 封</Tag>
                  </div>
                </Col>
              ))}
          </Row>
        </Card>
      )}
    </div>
  );
};

export default ClawShellMonitor;
