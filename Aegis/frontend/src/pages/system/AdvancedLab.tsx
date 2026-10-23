import { useState } from 'react';
import { Card, Form, Input, Select, Button, Table, Tag, message } from 'antd';
import { guardCheck } from '../../lib/qiseApi';

const { TextArea } = Input;

export default function AdvancedLab() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleCheck = async (values: any) => {
    setLoading(true);
    try {
      const data = await guardCheck({
        pipeline: values.pipeline,
        payload: JSON.parse(values.payload),
      });
      setResult(data);
    } catch (err: any) {
      message.error(err.message || '检查失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Card title="🧪 高级实验室" style={{ marginBottom: 16 }}>
        <Form form={form} layout="vertical" onFinish={handleCheck}>
          <Form.Item
            name="pipeline"
            label="管道"
            initialValue="ingress"
            rules={[{ required: true }]}
          >
            <Select>
              <Select.Option value="ingress">入口 (ingress)</Select.Option>
              <Select.Option value="egress">出口 (egress)</Select.Option>
              <Select.Option value="output">输出 (output)</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="payload"
            label="Payload (JSON)"
            rules={[
              { required: true, message: '请输入 JSON' },
              {
                validator: (_, value) => {
                  try {
                    JSON.parse(value);
                    return Promise.resolve();
                  } catch {
                    return Promise.reject(new Error('无效的 JSON'));
                  }
                },
              },
            ]}
          >
            <TextArea rows={6} placeholder='{"messages": [...]}' />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>
              执行检查
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {result && (
        <Card title="检查结果">
          <Tag color={result.verdict === 'pass' ? 'green' : 'red'}>{result.verdict}</Tag>
          {result.guards && result.guards.length > 0 && (
            <Table
              dataSource={Array.isArray(result?.guards) ? result.guards : []}
              rowKey="name"
              pagination={false}
              size="small"
              columns={[
                { title: '守卫', dataIndex: 'name', key: 'name' },
                {
                  title: '裁决',
                  dataIndex: 'verdict',
                  key: 'verdict',
                  render: (v: string) => <Tag color={v === 'pass' ? 'green' : 'red'}>{v}</Tag>,
                },
                { title: '消息', dataIndex: 'message', key: 'message' },
              ]}
            />
          )}
        </Card>
      )}
    </div>
  );
}
