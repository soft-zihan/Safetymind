import { useState } from 'react';
import { 
  Card, 
  Table, 
  Button, 
  Modal, 
  Form, 
  Input, 
  Select, 
  Space, 
  Tag, 
  Alert,
  Tabs 
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  SafetyOutlined,
  KeyOutlined
} from '@ant-design/icons';

const { Option } = Select;

interface APIKey {
  virtual_key: string;
  real_key: string;
  provider: string;
}

interface DLPPattern {
  name: string;
  regex: string;
  action: 'block' | 'redact';
}

const ClawShellConfig = () => {
  const [apiKeys, setApiKeys] = useState<APIKey[]>([
    { virtual_key: 'vk-dev-001', real_key: 'sk-***', provider: 'openai' },
    { virtual_key: 'vk-dev-002', real_key: 'sk-ant-***', provider: 'anthropic' },
  ]);
  
  const [dlpPatterns] = useState<DLPPattern[]>([
    { name: 'ssn', regex: '\\b\\d{3}-\\d{2}-\\d{4}\\b', action: 'redact' },
    { name: 'email', regex: '\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b', action: 'redact' },
  ]);

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [form] = Form.useForm();

  const showAddModal = () => {
    setEditingKey(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const showEditModal = (key: APIKey) => {
    setEditingKey(key.virtual_key);
    form.setFieldsValue(key);
    setIsModalVisible(true);
  };

  const handleCancel = () => {
    setIsModalVisible(false);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editingKey) {
        // 更新
        setApiKeys(apiKeys.map(k => k.virtual_key === editingKey ? values : k));
      } else {
        // 新增
        setApiKeys([...apiKeys, values]);
      }
      setIsModalVisible(false);
      form.resetFields();
    } catch (error) {
      console.error('验证失败:', error);
    }
  };

  const handleDelete = (virtualKey: string) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除虚拟密钥 ${virtualKey} 吗？`,
      onOk: () => {
        setApiKeys(apiKeys.filter(k => k.virtual_key !== virtualKey));
      },
    });
  };

  const apiKeyColumns = [
    {
      title: '虚拟密钥',
      dataIndex: 'virtual_key',
      key: 'virtual_key',
      render: (text: string) => (
        <Space>
          <KeyOutlined />
          <Tag color="blue">{text}</Tag>
        </Space>
      ),
    },
    {
      title: '真实密钥',
      dataIndex: 'real_key',
      key: 'real_key',
      render: (text: string) => <span style={{ fontFamily: 'monospace' }}>***{text.slice(-4)}</span>,
    },
    {
      title: '提供商',
      dataIndex: 'provider',
      key: 'provider',
      render: (text: string) => (
        <Tag color={text === 'openai' ? 'green' : 'orange'}>
          {text.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: APIKey) => (
        <Space>
          <Button 
            type="link" 
            icon={<EditOutlined />} 
            onClick={() => showEditModal(record)}
          >
            编辑
          </Button>
          <Button 
            type="link" 
            danger 
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.virtual_key)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  const dlpColumns = [
    {
      title: '规则名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => (
        <Space>
          <SafetyOutlined />
          {text}
        </Space>
      ),
    },
    {
      title: '正则表达式',
      dataIndex: 'regex',
      key: 'regex',
      render: (text: string) => (
        <code style={{ background: '#f5f5f5', padding: '2px 6px', borderRadius: 4 }}>
          {text}
        </code>
      ),
    },
    {
      title: '动作',
      dataIndex: 'action',
      key: 'action',
      render: (text: string) => (
        <Tag color={text === 'block' ? 'red' : 'gold'}>
          {text === 'block' ? '阻止' : '脱敏'}
        </Tag>
      ),
    },
  ];

  const items = [
    {
      key: 'api-keys',
      label: 'API 密钥管理',
      children: (
        <div>
          <Alert
            message="配置说明"
            description="虚拟密钥用于 OpenClaw 配置，ClawShell 会自动映射到真实密钥。真实密钥存储在 /etc/clawshell/ 中，受到文件系统权限保护。"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          
          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            onClick={showAddModal}
            style={{ marginBottom: 16 }}
          >
            添加密钥映射
          </Button>

          <Table 
            columns={apiKeyColumns} 
            dataSource={apiKeys} 
            rowKey="virtual_key"
            pagination={false}
          />
        </div>
      ),
    },
    {
      key: 'dlp-rules',
      label: 'DLP 规则配置',
      children: (
        <div>
          <Alert
            message="数据防泄漏 (DLP)"
            description="配置敏感数据检测规则。'阻止'会拒绝包含敏感数据的请求，'脱敏'会将敏感数据替换为 [REDACTED] 后转发。"
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
          
          <Table 
            columns={dlpColumns} 
            dataSource={dlpPatterns} 
            rowKey="name"
            pagination={false}
          />
        </div>
      ),
    },
    {
      key: 'config-file',
      label: '配置文件查看',
      children: (
        <div>
          <Alert
            message="配置文件位置"
            description="/etc/clawshell/clawshell.toml（生产环境）或项目根目录下的 clawshell.toml（开发环境）"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          
          <Card title="示例配置">
            <pre style={{ background: '#f5f5f5', padding: 16, borderRadius: 4, overflow: 'auto' }}>
{`version = "0.2.1"
log_level = "info"

[server]
host = "127.0.0.1"
port = 21789

[upstream]
openai_base_url = "https://api.openai.com"
anthropic_base_url = "https://api.anthropic.com"

[[keys]]
virtual_key = "vk-dev-001"
real_key = "sk-your-openai-key"
provider = "openai"

[dlp]
scan_responses = true
patterns = [
    { name = "ssn", regex = '\\b\\d{3}-\\d{2}-\\d{4}\\b', action = "redact" },
    { name = "email", regex = '\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b', action = "redact" },
]`}
            </pre>
          </Card>
        </div>
      ),
    },
  ];

  return (
    <div style={{ padding: '0 16px' }}>
      <Card>
        <Tabs items={items} />
      </Card>

      {/* 添加/编辑密钥对话框 */}
      <Modal
        title={editingKey ? '编辑密钥映射' : '添加密钥映射'}
        open={isModalVisible}
        onOk={handleSave}
        onCancel={handleCancel}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="virtual_key"
            label="虚拟密钥"
            rules={[{ required: true, message: '请输入虚拟密钥' }]}
          >
            <Input placeholder="例如: vk-dev-001" />
          </Form.Item>
          
          <Form.Item
            name="real_key"
            label="真实密钥"
            rules={[{ required: true, message: '请输入真实密钥' }]}
          >
            <Input.Password placeholder="sk-..." />
          </Form.Item>
          
          <Form.Item
            name="provider"
            label="提供商"
            rules={[{ required: true, message: '请选择提供商' }]}
          >
            <Select placeholder="选择提供商">
              <Option value="openai">OpenAI</Option>
              <Option value="anthropic">Anthropic</Option>
              <Option value="openrouter">OpenRouter</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ClawShellConfig;
