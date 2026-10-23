import { useState, useEffect, useCallback } from 'react'
import {
  Card, Row, Col, Table, Tag, Button, Space, Input, Modal,
  Form, Select, Statistic, Tooltip, Alert,
  Drawer, message, Spin, Empty,
} from 'antd'
import {
  DatabaseOutlined, PlusOutlined,
  SyncOutlined, SafetyOutlined, EyeOutlined,
  ReloadOutlined, SettingOutlined, FileTextOutlined,
} from '@ant-design/icons'
import { ApiErrorState } from '../../components/ApiErrorState'

const { Option } = Select
const { TextArea } = Input

// ====== 类型 ======
interface Dataset {
  id: string; name: string; category: string; type: string;
  samples: number; description: string; path?: string;
  task?: string; source?: string; status?: string;
}

interface Sample {
  id?: string;
  input?: string;
  content?: string;
  label?: string;
  verdict?: string;
  category?: string;
  metadata?: Record<string, any>;
  messages?: Array<{role: string; content: string}>;
}

interface Article {
  article: string;
  title: string;
}

interface LLMConfig {
  base_url: string;
  model: string;
  api_key: string;
}

// ====== 主组件 ======
export default function DatasetManager() {
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [selectedDs, setSelectedDs] = useState<Dataset | null>(null)
  const [samples, setSamples] = useState<Sample[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [complianceModal, setComplianceModal] = useState(false)
  const [createModal, setCreateModal] = useState(false)
  const [synthesizeLoading, setSynthesizeLoading] = useState(false)
  const [complianceForm] = Form.useForm()
  const [createForm] = Form.useForm()
  const [llmConfig, setLlmConfig] = useState<LLMConfig>({ base_url: '', model: '', api_key: '' })
  const [llmModalOpen, setLlmModalOpen] = useState(false)
  const [llmForm] = Form.useForm()
  const [promptModalOpen, setPromptModalOpen] = useState(false)
  const [currentPrompt, setCurrentPrompt] = useState('')
  const [currentRegulation, setCurrentRegulation] = useState('')
  const [promptHasCustom, setPromptHasCustom] = useState(false)
  const [regulations, setRegulations] = useState<Array<{name: string; articles: Article[]}>>([])
  const [complianceLoading, setComplianceLoading] = useState(false)

  // 加载数据集列表
  const loadDatasets = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/datasets')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setDatasets(data.datasets || [])
    } catch (err: any) {
      setError(err.message || '加载数据集失败')
    } finally {
      setLoading(false)
    }
  }

  // 加载 LLM 配置
  const loadLlmConfig = async () => {
    try {
      const res = await fetch('/api/datasets/llm-config')
      if (res.ok) {
        const cfg = await res.json()
        setLlmConfig(cfg)
      }
    } catch { /* ignore */ }
  }

  // 加载法规列表
  const loadRegulations = async () => {
    try {
      const res = await fetch('/api/datasets/regulations')
      if (res.ok) {
        const data = await res.json()
        setRegulations(data.regulations || [])
      }
    } catch { /* ignore */ }
  }

  useEffect(() => {
    loadDatasets()
    loadLlmConfig()
    loadRegulations()
  }, [])

  // 查看样本
  const viewSamples = async (ds: Dataset) => {
    setSelectedDs(ds)
    setSamples([])
    try {
      const res = await fetch(`/api/tools/datasets/${ds.id}?page=1&page_size=20`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setSamples(data.samples || [])
    } catch (err: any) {
      message.error(`加载样本失败: ${err.message}`)
      setSamples([])
    }
    setDrawerOpen(true)
  }

  // 重新合成
  const handleSynthesize = async (ds: Dataset) => {
    setSynthesizeLoading(true)
    try {
      const res = await fetch(`/api/tools/datasets/${ds.id}/synthesize?count=${ds.samples}`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      message.success('合成任务已启动，请稍后刷新查看结果')
    } catch (err: any) {
      message.error(`合成失败: ${err.message}`)
    } finally {
      setSynthesizeLoading(false)
    }
  }

  // 保存 LLM 配置
  const handleSaveLlmConfig = async (values: LLMConfig) => {
    try {
      const res = await fetch('/api/datasets/llm-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      message.success('LLM 配置已保存')
      setLlmConfig(values)
      setLlmModalOpen(false)
    } catch (err: any) {
      message.error(`保存失败: ${err.message}`)
    }
  }

  // 加载提示词
  const handleLoadPrompt = useCallback(async (regulation: string) => {
    setCurrentRegulation(regulation)
    try {
      const res = await fetch(`/api/datasets/compliance-prompts/${encodeURIComponent(regulation)}`)
      if (res.ok) {
        const data = await res.json()
        setCurrentPrompt(data.prompt || '')
        setPromptHasCustom(data.has_custom || false)
      }
    } catch { /* ignore */ }
    setPromptModalOpen(true)
  }, [])

  // 保存提示词
  const handleSavePrompt = async () => {
    try {
      const res = await fetch(`/api/datasets/compliance-prompts/${encodeURIComponent(currentRegulation)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: currentPrompt }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      message.success(`${currentRegulation} 提示词已保存`)
      setPromptModalOpen(false)
    } catch (err: any) {
      message.error(`保存失败: ${err.message}`)
    }
  }

  // 生成合规数据集
  const handleComplianceGen = async (values: { regulation: string; articles: string[]; samples_per_article: number }) => {
    setComplianceLoading(true)
    try {
      const res = await fetch('/api/tools/datasets/compliance-gen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          regulation: values.regulation,
          articles: values.articles || [],
          samples_per_article: values.samples_per_article,
        }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || `HTTP ${res.status}`)
      }
      const data = await res.json()
      if (data.errors?.length) {
        message.warning(`生成完成，但 ${data.errors.length} 个条款失败`)
      } else {
        message.success(`已生成 ${data.samples} 条合规测试用例（覆盖 ${data.articles} 个条款）`)
      }
      loadDatasets()
    } catch (err: any) {
      message.error(`生成失败: ${err.message}`)
    } finally {
      setComplianceLoading(false)
    }
    setComplianceModal(false)
  }

  // 创建自定义数据集
  const handleCreate = async (values: { name: string; description: string; category: string }) => {
    try {
      const res = await fetch('/api/tools/datasets/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: values.name,
          description: values.description,
          category: values.category,
          samples: [],
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      message.success('数据集已创建')
      loadDatasets()
    } catch (err: any) {
      message.error(`创建失败: ${err.message}`)
    }
    setCreateModal(false)
    createForm.resetFields()
  }

  // 按类别统计
  const categoryMap: Record<string, string> = {
    benchmark: '基准数据集',
    local_eval: '本地评估',
    synthetic: '合成训练',
    compliance: '合规攻击',
    custom: '自定义',
  }

  const categoryCounts = {
    benchmark: datasets.filter(d => d.category === 'benchmark').length,
    local_eval: datasets.filter(d => d.category === 'local_eval').length,
    synthetic: datasets.filter(d => d.category === 'synthetic').length,
    compliance: datasets.filter(d => d.category === 'compliance').length,
    custom: datasets.filter(d => d.category === 'custom').length,
  }

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name', render: (v: string, r: Dataset) => (
      <a onClick={() => viewSamples(r)}>{v}</a>
    )},
    { title: '类型', dataIndex: 'category', key: 'category', width: 100,
      render: (v: string) => {
        const colors: Record<string, string> = { benchmark: 'blue', local_eval: 'green', synthetic: 'orange', compliance: 'purple', custom: 'default' }
        const labels: Record<string, string> = { benchmark: '基准', local_eval: '本地', synthetic: '合成', compliance: '合规', custom: '自定义' }
        return <Tag color={colors[v] || 'default'}>{labels[v] || v}</Tag>
      }
    },
    { title: '样本数', dataIndex: 'samples', key: 'samples', width: 100, sorter: (a: Dataset, b: Dataset) => a.samples - b.samples },
    { title: '来源', dataIndex: 'source', key: 'source', width: 120, ellipsis: true },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    { title: '操作', key: 'actions', width: 120, render: (_: unknown, r: Dataset) => (
      <Space size="small">
        <Tooltip title="查看样本">
          <Button size="small" icon={<EyeOutlined />} onClick={() => viewSamples(r)} />
        </Tooltip>
        {r.category === 'synthetic' && (
          <Tooltip title="重新合成">
            <Button size="small" icon={<SyncOutlined />} loading={synthesizeLoading} onClick={() => handleSynthesize(r)} />
          </Tooltip>
        )}
      </Space>
    )},
  ]

  if (loading) {
    return <div style={{ padding: 40 }}><Spin size="large" tip="加载数据集..." /></div>
  }

  if (error) {
    return <ApiErrorState title="数据集加载失败" error={error} onRetry={loadDatasets} />
  }

  return (
    <div>
      <Row gutter={16}>
        {/* 左侧统计 */}
        <Col xs={24} md={6}>
          <Card title={<><DatabaseOutlined /> 数据集统计</>} size="small"
            extra={<Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => setCreateModal(true)}>新建</Button>}>
            <Row gutter={[8, 16]}>
              {Object.entries(categoryCounts).map(([k, v]) => (
                <Col span={12} key={k}>
                  <Statistic 
                    title={categoryMap[k] || k} 
                    value={v} 
                    valueStyle={{ fontSize: 18 }} 
                  />
                </Col>
              ))}
            </Row>
          </Card>
        </Col>

        {/* 右侧数据集列表 */}
        <Col xs={24} md={18}>
          <Card title="数据集列表" size="small"
            extra={
              <Space>
                <Button icon={<SafetyOutlined />} onClick={() => setComplianceModal(true)}>合规生成</Button>
                <Button icon={<ReloadOutlined />} onClick={loadDatasets}>刷新</Button>
              </Space>
            }>
            {datasets.length === 0 ? (
              <Empty description="暂无数据集">
                <Button type="primary" onClick={loadDatasets}>刷新</Button>
              </Empty>
            ) : (
              <Table 
                dataSource={datasets} 
                columns={columns} 
                rowKey="id" 
                size="small"
                pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 个数据集` }} 
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* 样本预览抽屉 */}
      <Drawer 
        title={selectedDs ? `${selectedDs.name} — 样本预览` : '样本预览'} 
        placement="right" 
        width={720}
        open={drawerOpen} 
        onClose={() => setDrawerOpen(false)}
        extra={selectedDs?.category === 'synthetic' && (
          <Button icon={<SyncOutlined />} loading={synthesizeLoading} onClick={() => selectedDs && handleSynthesize(selectedDs)}>
            重新合成
          </Button>
        )}
      >
        {selectedDs && (
          <div>
            <Card size="small" style={{ marginBottom: 16 }}>
              <p><strong>描述：</strong>{selectedDs.description}</p>
              <p><strong>样本数：</strong>{selectedDs.samples} | <strong>类型：</strong>{categoryMap[selectedDs.category] || selectedDs.category}</p>
              {selectedDs.source && <p><strong>来源：</strong>{selectedDs.source}</p>}
              {selectedDs.path && <p><strong>路径：</strong><code style={{ fontSize: 12 }}>{selectedDs.path}</code></p>}
            </Card>
            
            {samples.length === 0 ? (
              <Empty description="暂无样本" />
            ) : (
              <Table 
                dataSource={samples} 
                rowKey={(_, i) => `sample-${i}`} 
                size="small" 
                pagination={{ pageSize: 10 }}
                columns={[
                  { 
                    title: '输入', 
                    dataIndex: 'input', 
                    key: 'input', 
                    ellipsis: true,
                    render: (v: string, r: Sample) => {
                      const text = v || r.content || (r.messages?.[1]?.content) || '(无内容)'
                      return <code style={{ fontSize: 11 }}>{text}</code>
                    }
                  },
                  { 
                    title: '标签', 
                    key: 'label', 
                    width: 100,
                    render: (r: Sample) => {
                      const label = r.label || r.verdict || 'unknown'
                      const color = label === 'safe' ? 'green' : 
                                   label === 'suspicious' ? 'orange' : 
                                   label === 'malicious' || label === 'alarmed' ? 'red' : 'default'
                      return <Tag color={color}>{label}</Tag>
                    }
                  },
                  { title: '类别', dataIndex: 'category', key: 'category', width: 100 },
                ]} 
              />
            )}
          </div>
        )}
      </Drawer>

      {/* 合规数据集生成 */}
      <Modal 
        title="合规攻击数据集生成（LLM 驱动）" 
        open={complianceModal} 
        onCancel={() => setComplianceModal(false)} 
        onOk={() => complianceForm.submit()}
        okText="生成"
        confirmLoading={complianceLoading}
        width={640}
      >
        <Form form={complianceForm} layout="vertical" onFinish={handleComplianceGen} initialValues={{ regulation: '个人信息保护法', samples_per_article: 5, articles: [] }}>
          <Form.Item name="regulation" label="选择法规" rules={[{ required: true }]}>
            <Select onChange={() => {
              complianceForm.setFieldsValue({ articles: [] })
            }}>
              {regulations.map(r => <Option key={r.name} value={r.name}>{r.name}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.regulation !== cur.regulation}>
            {({ getFieldValue }) => {
              const reg = getFieldValue('regulation')
              const regData = regulations.find(r => r.name === reg)
              if (!regData) return null
              return (
                <Form.Item name="articles" label={`条款（不选则全部）`}>
                  <Select mode="multiple" placeholder="留空则覆盖全部条款">
                    {regData.articles.map((a: Article) => (
                      <Option key={a.article} value={a.article}>{a.article} - {a.title}</Option>
                    ))}
                  </Select>
                </Form.Item>
              )
            }}
          </Form.Item>
          <Form.Item name="samples_per_article" label="每个条款生成样本数" rules={[{ required: true }]}>
            <Select>
              {[3, 5, 10, 20].map(n => <Option key={n} value={n}>{n} 条/条款</Option>)}
            </Select>
          </Form.Item>
          <Alert 
            type="info" 
            showIcon 
            message={
              <span>
                系统将调用配置的 LLM 为每个条款生成攻击测试用例。
                {llmConfig.api_key ? (
                  <span> 当前模型: <strong>{llmConfig.model}</strong></span>
                ) : (
                  <span style={{ color: '#ff4d4f' }}> 未配置 LLM API Key！</span>
                )}
              </span>
            }
          />
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <Button icon={<SettingOutlined />} onClick={() => {
              llmForm.setFieldsValue(llmConfig)
              setLlmModalOpen(true)
            }}>LLM API 配置</Button>
            <Button icon={<FileTextOutlined />} onClick={() => {
              const reg = complianceForm.getFieldValue('regulation') || '个人信息保护法'
              handleLoadPrompt(reg)
            }}>编辑提示词</Button>
          </div>
        </Form>
      </Modal>

      {/* LLM API 配置弹窗 */}
      <Modal 
        title="LLM API 配置（OpenAI 兼容）" 
        open={llmModalOpen} 
        onCancel={() => setLlmModalOpen(false)} 
        onOk={() => llmForm.submit()}
        okText="保存"
      >
        <Form form={llmForm} layout="vertical" onFinish={handleSaveLlmConfig}>
          <Form.Item name="base_url" label="Base URL" rules={[{ required: true }]} extra="例如: https://api.openai.com/v1">
            <Input placeholder="https://api.openai.com/v1" />
          </Form.Item>
          <Form.Item name="model" label="模型" rules={[{ required: true }]} extra="例如: gpt-4o-mini, deepseek-chat">
            <Input placeholder="gpt-4o-mini" />
          </Form.Item>
          <Form.Item name="api_key" label="API Key" rules={[{ required: true }]} extra="密钥仅保存在本地，不会上传到任何服务器">
            <Input.Password placeholder="sk-..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* 提示词编辑弹窗 */}
      <Modal 
        title={`提示词模板 - ${currentRegulation}`} 
        open={promptModalOpen} 
        onCancel={() => setPromptModalOpen(false)} 
        onOk={handleSavePrompt}
        okText="保存"
        width={720}
      >
        <Alert 
          type="info" 
          showIcon 
          style={{ marginBottom: 12 }}
          message={
            promptHasCustom 
              ? '已使用自定义提示词（修改后点击保存生效）' 
              : '当前使用默认提示词模板，可在此编辑自定义版本'
          }
        />
        <p style={{ marginBottom: 8, color: '#666', fontSize: 12 }}>
          可用变量: <code>{'{regulation}'}</code> 法规名、<code>{'{article}'}</code> 条款号、<code>{'{title}'}</code> 条款标题、<code>{'{count}'}</code> 生成数量
        </p>
        <TextArea 
          rows={14} 
          value={currentPrompt} 
          onChange={(e) => setCurrentPrompt(e.target.value)}
          placeholder="留空则使用默认模板..."
          style={{ fontFamily: 'monospace', fontSize: 13 }}
        />
      </Modal>

      {/* 新建数据集 */}
      <Modal title="新建数据集" open={createModal} onCancel={() => setCreateModal(false)} onOk={() => createForm.submit()}>
        <Form form={createForm} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="category" label="类型" rules={[{ required: true }]}>
            <Select>
              <Option value="local_eval">本地评估 (YAML)</Option>
              <Option value="custom">自定义</Option>
            </Select>
          </Form.Item>
          <Form.Item name="description" label="描述"><TextArea rows={3} /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
