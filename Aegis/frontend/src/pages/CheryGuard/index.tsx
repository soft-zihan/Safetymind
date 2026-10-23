import { useState, useCallback, useEffect } from 'react'
import { Tabs, Alert, Spin } from 'antd'
import {
  DatabaseOutlined, PlayCircleOutlined, BarChartOutlined,
} from '@ant-design/icons'
import axios from 'axios'
import { API_BASE, type ModelInfo } from './shared'
import DatasetsTab from './DatasetsTab'
import InferTab from './InferTab'
import EvalTab from './EvalTab'

const { TabPane } = Tabs

export default function CheryGuard() {
  const [activeTab, setActiveTab] = useState('datasets')
  const [models, setModels] = useState<{ gen_models: ModelInfo[]; stream_models: ModelInfo[]; reference_models: ModelInfo[] } | null>(null)
  const [loading, setLoading] = useState(true)

  const loadModels = useCallback(async () => {
    setLoading(true)
    try {
      const res = await axios.get(`${API_BASE}/models`)
      setModels(res.data)
    } catch {
      setModels(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadModels() }, [loadModels])

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />

  return (
    <div>
      <Alert
        message="Safetymind v2.0 计划————安全模型 SafeGuard"
        description="Gen (LoRA CausalLM) + Stream (Backbone LoRA + Dual Classification Heads)，基于 Qwen3-0.6B 微调的安全分类模型"
        type="info" showIcon style={{ marginBottom: 16 }}
      />

      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab={<span><DatabaseOutlined /> 数据集</span>} key="datasets">
          <DatasetsTab />
        </TabPane>
        <TabPane tab={<span><PlayCircleOutlined /> 推理测试</span>} key="infer">
          <InferTab models={models} />
        </TabPane>
        <TabPane tab={<span><BarChartOutlined /> 评估结果</span>} key="eval">
          <EvalTab />
        </TabPane>
      </Tabs>
    </div>
  )
}
