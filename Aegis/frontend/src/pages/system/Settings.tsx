import { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Tabs, message, Divider } from 'antd';
import { getConfig, setConfig } from '../../lib/qiseApi';

export default function Settings() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [_config, setConfigState] = useState<any>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const data = await getConfig();
      setConfigState(data);
      form.setFieldsValue(data);
    } catch (err) {
      console.error('获取配置失败:', err);
    }
  };

  const handleSave = async (values: any) => {
    setLoading(true);
    try {
      await setConfig(values);
      message.success('配置已保存');
    } catch (err: any) {
      message.error(err.message || '保存失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title="⚙️ 系统设置">
      <Form form={form} layout="vertical" onFinish={handleSave}>
        <Tabs
          defaultActiveKey="general"
          items={[
            {
              key: 'general',
              label: '通用',
              children: (
                <>
                  <Form.Item name="language" label="语言" initialValue="zh">
                    <Input />
                  </Form.Item>
                  <Form.Item name="timezone" label="时区" initialValue="Asia/Shanghai">
                    <Input />
                  </Form.Item>
                </>
              ),
            },
            {
              key: 'proxy',
              label: '代理',
              children: (
                <>
                  <Form.Item name={['proxy', 'port']} label="端口" initialValue={8080}>
                    <Input type="number" />
                  </Form.Item>
                  <Form.Item name={['proxy', 'auto_takeover']} label="自动接管" initialValue={true}>
                    <Input />
                  </Form.Item>
                </>
              ),
            },
          ]}
        />

        <Divider />

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            保存配置
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
}
