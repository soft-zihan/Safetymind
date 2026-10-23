import { Result, Table, Tag, Statistic, Row, Col, Card } from 'antd';
import type { ScanReport, ScanCollection } from '../types';

interface ScanResultPanelProps {
  result: ScanReport | ScanCollection | null;
}

const severityColor: Record<string, string> = {
  high: 'red',
  medium: 'orange',
  low: 'green',
};

export default function ScanResultPanel({ result }: ScanResultPanelProps) {
  if (!result) return null;

  const isCollection = 'reports' in result;

  if (isCollection) {
    const collection = result as ScanCollection;
    const summary = collection.summary;
    return (
      <div>
        <Result
          status={collection.verdict === 'pass' ? 'success' : 'warning'}
          title={collection.verdict === 'pass' ? '扫描通过' : '发现风险'}
          subTitle={collection.recommendation}
        />
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={4}>
            <Card size="small">
              <Statistic title="总报告数" value={summary?.reports || 0} />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small">
              <Statistic title="拦截" value={summary?.block || 0} valueStyle={{ color: '#ff4d4f' }} />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small">
              <Statistic title="警告" value={summary?.warn || 0} valueStyle={{ color: '#faad14' }} />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small">
              <Statistic title="通过" value={summary?.pass || 0} valueStyle={{ color: '#52c41a' }} />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small">
              <Statistic title="跳过" value={summary?.skipped || 0} />
            </Card>
          </Col>
        </Row>
        {collection.reports?.map((report, idx) => (
          <ScanResultPanel key={idx} result={report} />
        ))}
      </div>
    );
  }

  const report = result as ScanReport;
  const findings = report.findings || [];

  return (
    <Card title={`扫描目标: ${report.target || '未知'}`} size="small" style={{ marginBottom: 16 }}>
      <Tag color={severityColor[report.risk?.severity || 'low']}>
        {report.risk?.severity || 'low'}
      </Tag>
      {findings.length > 0 && (
        <Table
          dataSource={findings}
          rowKey={(_, idx) => idx?.toString() || '0'}
          pagination={false}
          size="small"
          columns={[
            {
              title: '严重程度',
              dataIndex: 'severity',
              key: 'severity',
              render: (sev: string) => <Tag color={severityColor[sev || 'low']}>{sev}</Tag>,
            },
            {
              title: '类别',
              dataIndex: 'category',
              key: 'category',
            },
            {
              title: '消息',
              dataIndex: 'message',
              key: 'message',
            },
          ]}
        />
      )}
    </Card>
  );
}
