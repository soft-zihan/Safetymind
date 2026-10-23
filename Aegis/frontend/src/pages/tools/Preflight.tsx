import { useState } from 'react';
import { Card, Button, Alert, Row, Col, Statistic, Tag, Table, Collapse, Space, Spin, message } from 'antd';
import { ScanOutlined, CheckCircleOutlined, WarningOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { preflightScan } from '../../lib/qiseApi';
import { ApiErrorState } from '../../components/ApiErrorState';

const severityColor: Record<string, string> = { high: 'red', medium: 'orange', low: 'green' };

interface ScanReport {
  target: string;
  target_type: string;
  risk?: { severity: string };
  findings?: Array<{ severity: string; category: string; message: string }>;
  recommendation?: string;
}

export default function Preflight() {
  const [loading, setLoading] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const handleScan = async () => {
    setLoading(true);
    setError(null);
    setParseError(null);
    try {
      const result = await preflightScan({
        mode: 'all',
        selected_agents: []
      } as any);
      setScanResult(result);
      setScanned(true);
      message.success('扫描完成');
    } catch (err: any) {
      setError(err.message || '扫描失败');
      message.error('扫描失败，请检查后端服务');
    } finally {
      setLoading(false);
    }
  };

  if (error && !scanned) {
    return <ApiErrorState error={error} onRetry={handleScan} />;
  }

  const summary = scanResult?.summary || {};
  
  // 安全地解析details - 可能是JSON或纯文本
  let reports: ScanReport[] = [];
  let detailsText: string | null = null;
  
  if (scanResult?.details) {
    // 先尝试作为JSON解析
    if (typeof scanResult.details === 'string') {
      try {
        const parsed = JSON.parse(scanResult.details);
        reports = parsed?.reports || [];
      } catch {
        // 不是JSON，作为纯文本显示
        detailsText = scanResult.details;
        reports = [];
      }
    } else if (typeof scanResult.details === 'object') {
      // 已经是对象
      reports = scanResult.details?.reports || [];
    }
  }

  return (
    <div>
      <Alert message="上线前扫描" description="在 Agent 上线前进行全面安全扫描，检查配置漏洞、供应链风险和凭据暴露等问题。" type="info" showIcon style={{ marginBottom: 16 }} />

      <Card title="🔍 扫描控制" style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col flex="auto">
            <Space>
              <span>扫描目标：</span>
              <Tag color="blue">所有 Agent</Tag>
              <span>模式：</span>
              <Tag>全面扫描</Tag>
            </Space>
          </Col>
          <Col>
            <Button 
              type="primary" 
              icon={<ScanOutlined />} 
              loading={loading} 
              onClick={handleScan}
            >
              开始扫描
            </Button>
          </Col>
        </Row>
      </Card>

      {loading && (
        <Card>
          <Spin size="large" style={{ display: 'block', margin: '40px auto' }} />
          <div style={{ textAlign: 'center', marginTop: 16, color: '#666' }}>
            正在执行全面安全扫描，请稍候...
          </div>
        </Card>
      )}

      {scanned && scanResult && (
        <>
          {/* 显示解析错误 */}
          {parseError && (
            <Alert
              message="解析错误"
              description={parseError}
              type="error"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}

          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={4}><Card size="small"><Statistic title="扫描报告" value={summary.reports || 0} /></Card></Col>
            <Col span={4}><Card size="small"><Statistic title="拦截" value={summary.block || 0} valueStyle={{ color: '#ff4d4f' }} prefix={<CloseCircleOutlined />} /></Card></Col>
            <Col span={4}><Card size="small"><Statistic title="警告" value={summary.warn || 0} valueStyle={{ color: '#faad14' }} prefix={<WarningOutlined />} /></Card></Col>
            <Col span={4}><Card size="small"><Statistic title="通过" value={summary.pass || 0} valueStyle={{ color: '#52c41a' }} prefix={<CheckCircleOutlined />} /></Card></Col>
            <Col span={4}><Card size="small"><Statistic title="最终裁决" value={scanResult.verdict || '—'} /></Card></Col>
          </Row>

          {reports.length > 0 ? (
            <Card title="📋 扫描结果">
              <Collapse
                defaultActiveKey={reports.map((_, i) => i.toString())}
                items={reports.map((report, idx) => ({
                  key: idx.toString(),
                  label: (
                    <Space>
                      <Tag color={severityColor[report.risk?.severity || 'low'] || 'default'}>{report.risk?.severity || 'low'}</Tag>
                      <span style={{ fontWeight: 500 }}>{report.target}</span>
                      <Tag>{report.target_type}</Tag>
                      <span style={{ color: '#666' }}>{report.findings?.length || 0} 个发现</span>
                    </Space>
                  ),
                  children: (
                    <div>
                      {report.recommendation && <div style={{ color: '#666', marginBottom: 8 }}>💡 {report.recommendation}</div>}
                      {(report.findings || []).length > 0 ? (
                        <Table dataSource={report.findings} rowKey={(_, i) => `${idx}-${i}`} pagination={false} size="small"
                          columns={[
                            { title: '严重程度', dataIndex: 'severity', key: 'severity', width: 80, render: (s: string) => <Tag color={severityColor[s || 'low']}>{s || 'low'}</Tag> },
                            { title: '类别', dataIndex: 'category', key: 'category', width: 140 },
                            { title: '消息', dataIndex: 'message', key: 'message' },
                          ]}
                        />
                      ) : (
                        <div style={{ color: '#52c41a' }}>✅ 未发现问题</div>
                      )}
                    </div>
                  ),
                }))}
              />
            </Card>
          ) : detailsText ? (
            /* 显示纯文本扫描结果 */
            <Card title="📋 扫描结果">
              <pre style={{ 
                whiteSpace: 'pre-wrap', 
                wordBreak: 'break-word', 
                fontSize: 13, 
                lineHeight: 1.6,
                backgroundColor: '#f5f5f5',
                padding: 16,
                borderRadius: 4,
                maxHeight: 600,
                overflow: 'auto'
              }}>
                {detailsText}
              </pre>
            </Card>
          ) : (
            <Card>
              <Alert
                message="扫描完成"
                description={scanResult.verdict === 'pass' ? '✅ 所有检查项均已通过' : '扫描完成但未发现详细报告'}
                type={scanResult.verdict === 'pass' ? 'success' : 'info'}
                showIcon
              />
            </Card>
          )}
        </>
      )}
    </div>
  );
}
