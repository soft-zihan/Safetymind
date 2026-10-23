import { useState, useEffect } from 'react';
import { Card, Tag, Radio, Collapse, Table, Space, Alert, Statistic, Row, Col } from 'antd';
import { getGuards, setGuardMode } from '../../lib/qiseApi';
import type { GuardInfo } from '../../lib/types';

const MODES = ['observe', 'enforce', 'off'] as const;
const modeLabel: Record<string, string> = { observe: '观察', enforce: '拦截', off: '关闭' };
const modeColor: Record<string, string> = { observe: 'blue', enforce: 'green', off: 'default' };
const pipelineLabel: Record<string, string> = { ingress: '🛡️ 入口防护 (Ingress)', egress: '🚪 出口防护 (Egress)', output: '📤 输出过滤 (Output)' };
const pipelineDesc: Record<string, string> = {
  ingress: '检查进入 Agent 的请求内容：Prompt 注入、工具健全性、上下文一致性、供应链安全',
  egress: '检查 Agent 发起的操作：命令执行、文件访问、网络请求、数据外泄、资源滥用',
  output: '审计 Agent 输出内容：凭据泄露、隐私信息、推理操纵、跨轮次风险',
};

const guardDescriptions: Record<string, string> = {
  PromptGuard: '检测 Prompt 注入攻击（直接注入、间接注入、越狱尝试）',
  ToolSanityGuard: '验证工具调用参数的合法性和完整性',
  ContextGuard: '检查上下文一致性，防止上下文投毒',
  SupplyChainGuard: '检测第三方 Skill/MCP 工具的供应链攻击',
  CommandGuard: '拦截危险 Shell 命令（rm -rf、反向 Shell、权限提升）',
  FilesystemGuard: '保护敏感文件路径（~/.ssh、~/.gnupg、系统文件）',
  NetworkGuard: 'SSRF 防护、CIDR 白名单、出站连接控制',
  ExfilGuard: 'AI 检测数据外泄行为（curl/wget 外发、DNS 隧道）',
  ResourceGuard: 'AI 检测资源滥用（无限循环、行为异常、资源耗尽）',
  ReasoningGuard: 'AI 分析 Agent 推理链中的恶意意图',
  ToolPolicyGuard: '工具执行策略（deny/allow 列表）',
  CredentialGuard: '检测输出中的凭据泄露（API Key、密码、Token）',
  AuditGuard: '跨轮次审计关联，检测渐进式攻击',
  OutputGuard: '输出内容安全过滤（KB 泄露、PII 暴露）',
};

export default function ProtectionRules() {
  const [guards, setGuards] = useState<GuardInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadGuards(); }, []);

  const loadGuards = async () => {
    try {
      const data = await getGuards();
      setGuards(Array.isArray(data) ? data : []);
    } catch {
      setGuards([]);
    } finally { setLoading(false); }
  };

  const handleSetMode = async (name: string, mode: string) => {
    try {
      await setGuardMode(name, mode);
      loadGuards();
    } catch {
      setGuards(prev => prev.map(g => g.name === name ? { ...g, mode } : g));
    }
  };

  const enforceCount = guards.filter(g => g.mode === 'enforce').length;
  const observeCount = guards.filter(g => g.mode === 'observe').length;
  const aiCount = guards.filter(g => g.primary_strategy === 'ai').length;

  return (
    <div>
      {guards.length === 0 && !loading && (
        <Alert message="未加载防护规则" description="后端未连接或无规则配置。请确保 qise 防护服务已启动。" type="info" showIcon style={{ marginBottom: 16 }} />
      )}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card size="small"><Statistic title="总守卫数" value={guards.length} suffix="个" /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="拦截模式" value={enforceCount} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="观察模式" value={observeCount} valueStyle={{ color: '#1890ff' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="AI 驱动" value={aiCount} valueStyle={{ color: '#722ed1' }} /></Card></Col>
      </Row>

      <Card title="📏 防护规则管理" style={{ marginBottom: 16 }}>
        <Space style={{ marginBottom: 16 }}>
          <span>全局预设：</span>
          <Radio.Group defaultValue="balanced" buttonStyle="solid">
            <Radio.Button value="balanced">均衡模式</Radio.Button>
            <Radio.Button value="strict">严格模式</Radio.Button>
            <Radio.Button value="observe">仅观察</Radio.Button>
          </Radio.Group>
        </Space>

        <Collapse
          defaultActiveKey={['ingress', 'egress', 'output']}
          items={['ingress', 'egress', 'output'].map(pipeline => {
            const pipelineGuards = guards.filter(g => g.pipeline === pipeline);
            return {
              key: pipeline,
              label: (
                <Space>
                  <span>{pipelineLabel[pipeline]}</span>
                  <Tag color="blue">{pipelineGuards.length} 个守卫</Tag>
                  <Tag color="purple">{pipelineGuards.filter(g => g.primary_strategy === 'ai').length} AI</Tag>
                </Space>
              ),
              children: (
                <div>
                  <div style={{ color: '#888', marginBottom: 12, fontSize: 13 }}>{pipelineDesc[pipeline]}</div>
                  <Table
                    dataSource={pipelineGuards}
                    rowKey="name"
                    loading={loading}
                    pagination={false}
                    size="small"
                    columns={[
                      { title: '守卫', dataIndex: 'name', key: 'name', render: (name: string) => <span style={{ fontWeight: 600 }}>{name}</span> },
                      { title: '描述', key: 'desc', render: (_: any, r: GuardInfo) => <span style={{ color: '#666', fontSize: 13 }}>{guardDescriptions[r.name] || '—'}</span> },
                      { title: '策略', dataIndex: 'primary_strategy', key: 'strategy', width: 80, render: (s: string) => <Tag color={s === 'ai' ? 'purple' : 'default'}>{s === 'ai' ? 'AI' : '规则'}</Tag> },
                      {
                        title: '模式', key: 'mode', width: 200,
                        render: (_: any, record: GuardInfo) => (
                          <Radio.Group value={record.mode} onChange={(e) => handleSetMode(record.name, e.target.value)} size="small">
                            {MODES.map(mode => (
                              <Radio.Button key={mode} value={mode}>
                                <Tag color={modeColor[mode]} style={{ border: 'none', background: 'transparent', padding: 0 }}>{modeLabel[mode]}</Tag>
                              </Radio.Button>
                            ))}
                          </Radio.Group>
                        ),
                      },
                    ]}
                  />
                </div>
              ),
            };
          })}
        />
      </Card>
    </div>
  );
}
