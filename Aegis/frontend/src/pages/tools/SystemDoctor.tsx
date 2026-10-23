import { useState, useEffect } from 'react';
import { Card, Button, List, Tag, Row, Col, Statistic, Alert, Timeline, Progress } from 'antd';
import { CheckCircleOutlined, WarningOutlined, CloseCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { runDiagnostics } from '../../lib/qiseApi';

const statusIcon: Record<string, React.ReactNode> = {
  pass: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
  warn: <WarningOutlined style={{ color: '#faad14' }} />,
  fail: <CloseCircleOutlined style={{ color: '#ff4d4f' }} />,
};
const statusTag: Record<string, string> = { pass: 'green', warn: 'orange', fail: 'red' };
const statusLabel: Record<string, string> = { pass: '通过', warn: '警告', fail: '失败' };

export default function SystemDoctor() {
  const [loading, setLoading] = useState(false);
  const [checks, setChecks] = useState<any[]>([]);
  const [completed, setCompleted] = useState(false);
  const [runHistory] = useState<{ time: string; result: string; count: number }[]>([
    { time: '2026-06-05 10:00', result: '12 通过, 2 警告', count: 14 },
    { time: '2026-06-04 09:30', result: '11 通过, 3 警告', count: 14 },
    { time: '2026-06-03 14:15', result: '14 通过, 0 警告', count: 14 },
  ]);

  useEffect(() => { handleRun(); }, []);

  const handleRun = async () => {
    setLoading(true); setCompleted(false); setChecks([]);
    try {
      const data = await runDiagnostics();
      // 后端成功时返回 {status: "ok", report: {checks: [...]}}
      // 后端降级时返回 {checks: [...]}
      let rawChecks: any[] = [];
      if (data?.report?.checks) {
        rawChecks = data.report.checks;
      } else if (data?.checks) {
        rawChecks = data.checks;
      }
      // 统一 status 格式：ok→pass, error→fail, warning→warn
      const statusMap: Record<string, string> = { ok: 'pass', error: 'fail', warning: 'warn' };
      const normalized = rawChecks.map((c: any) => ({
        name: c.name,
        status: statusMap[c.status] || c.status,
        message: c.detail || c.message || '',
      }));
      setChecks(normalized);
      setCompleted(true);
    } catch {
      setCompleted(true);
    } finally { setLoading(false); }
  };

  const passCount = checks.filter(c => c.status === 'pass').length;
  const warnCount = checks.filter(c => c.status === 'warn').length;
  const failCount = checks.filter(c => c.status === 'fail').length;
  const score = Math.round((passCount / checks.length) * 100);

  return (
    <div>
      {checks.length === 0 && completed && <Alert message="无法获取诊断数据" description="后端未连接或诊断服务未启动。" type="info" showIcon style={{ marginBottom: 16 }} />}

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <div style={{ textAlign: 'center' }}>
              <Progress type="circle" percent={completed ? score : 0} size={80}
                strokeColor={score >= 80 ? '#52c41a' : score >= 60 ? '#faad14' : '#ff4d4f'}
                format={p => <span style={{ fontSize: 18, fontWeight: 700 }}>{p}</span>} />
              <div style={{ marginTop: 8, color: '#666' }}>安全健康评分</div>
            </div>
          </Card>
        </Col>
        <Col span={6}><Card size="small"><Statistic title="检查通过" value={passCount} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="警告" value={warnCount} prefix={<WarningOutlined />} valueStyle={{ color: '#faad14' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="失败" value={failCount} prefix={<CloseCircleOutlined />} valueStyle={{ color: '#ff4d4f' }} /></Card></Col>
      </Row>

      <Card title="🩺 系统诊断" style={{ marginBottom: 16 }}
        extra={<Button type="primary" icon={<ReloadOutlined />} onClick={handleRun} loading={loading}>重新诊断</Button>}>
        <List
          dataSource={checks}
          renderItem={(check: any) => (
            <List.Item style={{ padding: '12px 0' }}>
              <List.Item.Meta
                avatar={<span style={{ fontSize: 20 }}>{statusIcon[check.status]}</span>}
                title={<span style={{ fontWeight: 500 }}>{check.name}</span>}
                description={<span style={{ color: '#666' }}>{check.message}</span>}
              />
              <Tag color={statusTag[check.status]}>{statusLabel[check.status]}</Tag>
            </List.Item>
          )}
        />
      </Card>

      <Card title="📋 诊断历史">
        <Timeline
          items={runHistory.map(h => ({
            color: h.result.includes('失败') ? 'red' : h.result.includes('警告') ? 'orange' : 'green',
            children: (
              <div>
                <span style={{ fontWeight: 500 }}>{h.time}</span>
                <div style={{ color: '#666', fontSize: 13 }}>{h.result}（共 {h.count} 项检查）</div>
              </div>
            ),
          }))}
        />
      </Card>
    </div>
  );
}
