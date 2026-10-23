import { useState, useEffect } from 'react'
import { Row, Col, Card, List, Button, Tag, message, Input, Space, Descriptions, Badge, Modal, Typography, Alert, Tabs, Collapse } from 'antd'
import { PlayCircleOutlined, RobotOutlined, InfoCircleOutlined, ReloadOutlined, SettingOutlined, SafetyOutlined } from '@ant-design/icons'
import axios from 'axios'
import AttackChainView from './components/AttackChainView'
import WhatIfPanel from './components/WhatIfPanel'

const { TextArea } = Input
const { Paragraph } = Typography
const { Panel } = Collapse

interface Scenario {
  id: number
  name: string
  description: string
  risk_level: string
  prompt: string
  expected_naked: string
  expected_hardened: string
  judge_criteria_ref?: string
  judge_criteria?: any
  has_custom_judge_criteria?: boolean
  security_feature?: string
  sandbox_related?: boolean
  attack_category?: string
  attack_stages?: any[]
  defense_layers?: Record<string, any>
}

interface JudgeResult {
  naked_judge: string
  hardened_judge: string
  naked_judge_display: string
  hardened_judge_display: string
  judge_reason: string
  judge_raw_output: string
  ai_judged: boolean
}

interface TestResult {
  scenario_id: number
  naked_response: string
  hardened_response: string
  naked_result: string
  hardened_result: string
  leak_detected: boolean
  judge_result?: JudgeResult
  report?: any
  error?: string
  timestamp?: string
}

function Sandbox() {
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null)
  // 懒初始化：直接从 localStorage 恢复测试结果，避免空白期
  const [testResults, setTestResults] = useState<Map<number, TestResult>>(() => {
    try {
      const saved = localStorage.getItem('sandbox_test_results')
      if (saved) {
        const arr: [number, TestResult][] = JSON.parse(saved)
        if (arr.length > 0) return new Map<number, TestResult>(arr)
      }
    } catch {}
    return new Map()
  })
  const [loadingScenarios, setLoadingScenarios] = useState<Set<number>>(new Set())
  const [customPrompt, setCustomPrompt] = useState('')
  const [promptSaved, setPromptSaved] = useState(false)  // 保存按钮反馈
  const [judgeCriteriaVisible, setJudgeCriteriaVisible] = useState(false)
  const [judgeCriteriaText, setJudgeCriteriaText] = useState('')
  const [_judgeCriteriaLoading, setJudgeCriteriaLoading] = useState(false)
  const [judgeCriteriaChanged, setJudgeCriteriaChanged] = useState(false)
  
  // 新增状态：攻击链数据（按场景ID缓存）、顶层 Tab、模型配置
  const [topTab, setTopTab] = useState<string>('drill')
  const [attackChainDataMap, setAttackChainDataMap] = useState<Map<number, any>>(new Map())
  const [attackChainLoading, setAttackChainLoading] = useState(false)
  const [resultTab, setResultTab] = useState<string>('compare')
  const [defenseEnabled, setDefenseEnabled] = useState<Record<string, boolean>>({
    L1_clawshell: true,
    L2_qise: true,
    L3_openclaw: true,
    L4_clawkeeper: true,
    L5_docker: true,
  })
  const [modelConfig, setModelConfig] = useState<any>(null)

  useEffect(() => {
    fetchScenarios()
  }, [])



  // 加载评判标准到编辑器
  const loadJudgeCriteria = async (scenarioId: number) => {
    try {
      const res = await axios.get(`/api/demos/judge-criteria/${scenarioId}`)
      const merged = res.data.merged
      setJudgeCriteriaText(JSON.stringify(merged, null, 2))
      setJudgeCriteriaChanged(false)
    } catch (error) {
      console.error('加载评判标准失败:', error)
    }
  }

  // 打开评判标准编辑 Modal
  const openJudgeCriteriaEditor = async () => {
    if (!selectedScenario) return
    setJudgeCriteriaLoading(true)
    setJudgeCriteriaVisible(true)
    await loadJudgeCriteria(selectedScenario.id)
    setJudgeCriteriaLoading(false)
  }

  // 保存评判标准
  const saveJudgeCriteria = async () => {
    if (!selectedScenario) return
    try {
      const parsed = JSON.parse(judgeCriteriaText)
      await axios.put(`/api/demos/judge-criteria/${selectedScenario.id}`, parsed)
      message.success('评判标准已保存')
      setJudgeCriteriaChanged(false)
      setJudgeCriteriaVisible(false)
    } catch (error: any) {
      if (error instanceof SyntaxError) {
        message.error('JSON 格式错误，请检查')
      } else {
        message.error(error.response?.data?.detail || '保存失败')
      }
    }
  }

  // 重置为默认评判标准
  const resetJudgeCriteria = async () => {
    if (!selectedScenario) return
    try {
      await axios.post(`/api/demos/judge-criteria/${selectedScenario.id}/reset`)
      message.success('已重置为默认评判标准')
      await loadJudgeCriteria(selectedScenario.id)
    } catch (error) {
      console.error('重置失败:', error)
    }
  }

  // 保存测试结果到 localStorage
  useEffect(() => {
    if (testResults.size > 0) {
      const resultsArray = Array.from(testResults.entries()).map(([key, value]) => [key, value])
      localStorage.setItem('sandbox_test_results', JSON.stringify(resultsArray))
    }
  }, [testResults])

  const [_scenariosLoading, setScenariosLoading] = useState(false)

  const fetchScenarios = async () => {
    setScenariosLoading(true)
    try {
      const res = await axios.get('/api/demos/scenarios', { timeout: 15000 })
      const all = [
        ...res.data.categories.critical,
        ...res.data.categories.high,
        ...res.data.categories.medium,
      ]
      // 全局按 ID 排序，避免按风险等级分组拼接后 ID 不连续
      all.sort((a, b) => a.id - b.id)
      setScenarios(all)
      if (all.length > 0) {
        setSelectedScenario(all[0])
        setCustomPrompt(all[0].prompt)
      }
    } catch (error: any) {
      console.error('获取场景失败:', error)
      // 明确显示错误信息
      const errorMsg = error.response?.data?.detail || error.message || '获取演示场景失败'
      message.error(`获取场景失败: ${errorMsg}`, 5)
      
      // 如果没有任何数据,保留错误状态
      if (scenarios.length === 0) {
        console.error('❌ 无可用场景数据,请检查后端服务')
      }
    } finally {
      setScenariosLoading(false)
    }
  }

  // 获取攻击链数据（多阶段场景），结果按场景ID缓存
  const fetchAttackChain = async (scenarioId: number) => {
    setAttackChainLoading(true)
    try {
      // 清理会话上下文，确保测试独立性
      try {
        const clearRes = await axios.post('/api/demos/sessions/clear', {}, { timeout: 15000 })
        if (clearRes.data.success) {
          message.info('🧹 会话已清理，开始攻击链测试')
        }
      } catch (clearError) {
        // 清理失败不阻塞测试流程，仅记录日志
        console.warn('⚠️ 会话清理失败，继续执行攻击链测试:', clearError)
      }
      
      const res = await axios.get(`/api/demos/scenarios/${scenarioId}/attack-chain`, { timeout: 600000 })
      setAttackChainDataMap(prev => {
        const next = new Map(prev)
        next.set(scenarioId, res.data)
        return next
      })
    } catch (error: any) {
      console.error('获取攻击链失败:', error)
      const errorMsg = error.response?.data?.detail || error.message || '获取攻击链数据失败'
      message.error(`获取攻击链失败: ${errorMsg}`, 5)
      // 清除该场景的缓存数据，不允许显示过期数据
      setAttackChainDataMap(prev => {
        const next = new Map(prev)
        next.delete(scenarioId)
        return next
      })
    } finally {
      setAttackChainLoading(false)
    }
  }

  // 获取模型配置
  const fetchModelConfig = async () => {
    try {
      const res = await axios.get('/api/demos/model-config')
      setModelConfig(res.data.models)
    } catch (error: any) {
      console.error('获取模型配置失败:', error)
      const errorMsg = error.response?.data?.detail || error.message || '获取模型配置失败'
      message.error(`获取模型配置失败: ${errorMsg}`, 5)
      setModelConfig(null) // 清除旧数据
    }
  }

  // 处理防御层切换
  const handleDefenseChange = (layerId: string, enabled: boolean) => {
    if (layerId) {
      setDefenseEnabled(prev => ({ ...prev, [layerId]: enabled }))
    }
    // 重新获取攻击链数据
    if (selectedScenario?.attack_stages) {
      fetchAttackChain(selectedScenario.id)
    }
  }

  // 判断是否为多阶段场景
  const isMultiStage = (scenario: Scenario | null) => {
    return scenario?.attack_stages && scenario.attack_stages.length > 0
  }

  // 攻击链数据变更（人工审查切换结果等），更新缓存
  const handleAttackChainDataChange = (scenarioId: number, updatedData: any) => {
    setAttackChainDataMap(prev => {
      const next = new Map(prev)
      next.set(scenarioId, updatedData)
      return next
    })
  }

  // 用修改后的提示词重新测试攻击链（POST）
  const handleAttackChainRetest = async (scenarioId: number, promptOverrides: Record<number, string>) => {
    if (!selectedScenario) return
    setAttackChainLoading(true)
    try {
      // 清理会话
      try {
        await axios.post('/api/demos/sessions/clear', {}, { timeout: 15000 })
      } catch (clearError) {
        console.warn('⚠️ 会话清理失败，继续执行:', clearError)
      }

      const res = await axios.post(`/api/demos/scenarios/${scenarioId}/attack-chain`, {
        prompt_overrides: promptOverrides,
      }, { timeout: 600000 })

      setAttackChainDataMap(prev => {
        const next = new Map(prev)
        next.set(scenarioId, res.data)
        return next
      })
      message.success('攻击链重新测试完成')
    } catch (error: any) {
      console.error('重新测试攻击链失败:', error)
      message.error(`重新测试失败: ${error.response?.data?.detail || error.message}`)
    } finally {
      setAttackChainLoading(false)
    }
  }

  const runTest = async () => {
    if (!selectedScenario) return
    await runSingleTest(selectedScenario.id, customPrompt)
  }

  // 手动保存提示词（替换默认）
  const savePrompt = async () => {
    if (!selectedScenario) return
    try {
      await axios.post(`/api/demos/scenarios/${selectedScenario.id}/prompt`, customPrompt, {
        headers: { 'Content-Type': 'text/plain' }
      })
      setPromptSaved(true)
      message.success('提示词已保存，下次打开此场景将使用新内容')
      setTimeout(() => setPromptSaved(false), 2000)
      
      // 更新本地场景列表中的 prompt，避免刷新后丢失
      setScenarios(prev => prev.map(s => 
        s.id === selectedScenario.id ? { ...s, prompt: customPrompt } : s
      ))
      // 更新当前选中的场景
      setSelectedScenario(prev => prev ? { ...prev, prompt: customPrompt } : null)
    } catch (error) {
      message.error('保存失败')
    }
  }

  // 独立测试单个场景
  const runSingleTest = async (scenarioId: number, prompt: string) => {
    if (loadingScenarios.has(scenarioId)) return
    
    setLoadingScenarios(prev => new Set(prev).add(scenarioId))
    try {
      // 清理会话上下文，确保测试独立性
      try {
        const clearRes = await axios.post('/api/demos/sessions/clear', {}, { timeout: 15000 })
        if (clearRes.data.success) {
          message.info('🧹 会话已清理，开始测试')
        }
      } catch (clearError) {
        // 清理失败不阻塞测试流程，仅记录日志
        console.warn('⚠️ 会话清理失败，继续执行测试:', clearError)
      }
      
      const res = await axios.post(`/api/demos/scenarios/${scenarioId}/test`, {
        prompt_override: prompt,
      }, {
        timeout: 300000  // 5 分钟，Gateway 多步命令执行很慢
      })
      
      const resultWithTimestamp = {
        ...res.data,
        timestamp: new Date().toLocaleString('zh-CN')
      }
      
      const newResults = new Map(testResults)
      newResults.set(scenarioId, resultWithTimestamp)
      setTestResults(newResults)
      
      // 根据实际结果给出不同反馈
      const nr = res.data?.naked_result
      const hr = res.data?.hardened_result
      if (nr === 'timeout' || nr === 'error' || hr === 'timeout' || hr === 'error') {
        message.warning(`场景 ${scenarioId} 测试异常 - Gateway 或网络不可用，查看下方详情`)
      } else {
        message.success(`场景 ${scenarioId} 测试完成`)
      }
    } catch (error: any) {
      // 即使请求失败也保存错误结果，确保前端有反馈
      const errorResult: TestResult = {
        scenario_id: scenarioId,
        naked_response: `❌ 请求失败: ${error.message || '未知错误'}`,
        hardened_response: `❌ 请求失败: ${error.message || '未知错误'}`,
        naked_result: 'error',
        hardened_result: 'error',
        leak_detected: false,
        error: error.response?.data?.detail || error.message || '网络请求失败',
        timestamp: new Date().toLocaleString('zh-CN')
      }
      const newResults = new Map(testResults)
      newResults.set(scenarioId, errorResult)
      setTestResults(newResults)
      message.error(`场景 ${scenarioId} 测试失败 - ${error.message || '请检查后端和 Gateway 是否正常运行'}`)
    } finally {
      setLoadingScenarios(prev => {
        const next = new Set(prev)
        next.delete(scenarioId)
        return next
      })
    }
  }

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'critical': return 'red'
      case 'high': return 'orange'
      case 'medium': return 'gold'
      default: return 'blue'
    }
  }

  const getRiskText = (level: string) => {
    switch (level) {
      case 'critical': return '🔴 高危'
      case 'high': return '🟡 中危'
      case 'medium': return '🟢 低危'
      default: return '未知'
    }
  }

  // 场景选择时，如果多阶段场景且无缓存，自动获取攻击链数据；有缓存则直接显示
  useEffect(() => {
    if (selectedScenario && isMultiStage(selectedScenario)) {
      if (!attackChainDataMap.has(selectedScenario.id)) {
        fetchAttackChain(selectedScenario.id)
      }
    }
  }, [selectedScenario])

  // 获取模型配置
  useEffect(() => {
    fetchModelConfig()
  }, [])

  return (
    <>
    {/* 顶层 Tabs */}
    <Tabs
      activeKey={topTab}
      onChange={setTopTab}
      style={{ marginBottom: 16 }}
      items={[
        {
          key: 'drill',
          label: (
            <span>
              <SafetyOutlined />
              攻防演练
            </span>
          ),
          children: (
            <Row gutter={[16, 16]}>
              <Col span={8}>
                <Card title="📋 演示场景库" style={{ height: 'calc(100vh - 200px)', overflow: 'auto' }}>
                  {/* 模型配置折叠面板 */}
                  <Collapse ghost style={{ marginBottom: 12 }}>
                    <Panel header={<Space><SettingOutlined /><span>模型配置</span></Space>} key="model">
                      {modelConfig ? (
                        <Space direction="vertical" style={{ width: '100%' }}>
                          <div>
                            <span style={{ fontSize: 12, color: '#666' }}>Unsafe-Carmind：</span>
                            <Tag color="red">{modelConfig['naked-lobster']?.model || 'unknown'}</Tag>
                          </div>
                          <div>
                            <span style={{ fontSize: 12, color: '#666' }}>Safe-Carmind：</span>
                            <Tag color="green">{modelConfig['hardened-lobster']?.model || 'unknown'}</Tag>
                          </div>
                        </Space>
                      ) : (
                        <span style={{ fontSize: 12, color: '#999' }}>加载中...</span>
                      )}
                    </Panel>
                  </Collapse>
          <List
            dataSource={scenarios}
            renderItem={(item) => (
              <List.Item
                style={{
                  cursor: 'pointer',
                  background: selectedScenario?.id === item.id ? '#f0f0f0' : 'transparent',
                  padding: '12px 16px',
                  borderRadius: 8,
                  marginBottom: 8,
                  flexDirection: 'column',
                  alignItems: 'stretch',
                }}
                onClick={() => {
                  setSelectedScenario(item)
                  setCustomPrompt(item.prompt)
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  <List.Item.Meta
                    title={
                      <Space>
                        <span>场景 {item.id}: {item.name}</span>
                        <Tag color={getRiskColor(item.risk_level)}>{getRiskText(item.risk_level)}</Tag>
                        {item.sandbox_related && (
                          <Tag color="purple" style={{ fontSize: 11 }}>🐳 沙箱</Tag>
                        )}
                      </Space>
                    }
                    description={
                      <Space direction="vertical" size={0} style={{ width: '100%' }}>
                        <span>{item.description}</span>
                        {item.security_feature && (
                          <span style={{ fontSize: 11, color: '#888' }}>🔒 {item.security_feature}</span>
                        )}
                      </Space>
                    }
                    style={{ marginBottom: 0, flex: 1 }}
                  />
                  <Space style={{ flexShrink: 0, marginLeft: 8 }}>
                    <Button
                      size="small"
                      type="primary"
                      ghost
                      icon={<PlayCircleOutlined />}
                      loading={loadingScenarios.has(item.id)}
                      onClick={(e) => {
                        e.stopPropagation()
                        runSingleTest(item.id, item.prompt)
                      }}
                    >
                      测试
                    </Button>
                    {testResults.has(item.id) && (
                      <Badge
                        status={testResults.get(item.id)?.naked_result === 'fail' ? 'error' : 'success'}
                      />
                    )}
                  </Space>
                </div>
                
                {/* 内联测试结果 */}
                {testResults.has(item.id) && (() => {
                  const r = testResults.get(item.id)!
                  return (
                    <div style={{ marginTop: 8, width: '100%' }}>
                      {/* AI 评判摘要 */}
                      {r.judge_result ? (
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '4px 8px',
                          borderRadius: 4,
                          fontSize: 12,
                          background: '#f6ffed'
                        }}>
                          <span>
                            裸奔：
                            <Tag style={{ fontSize: 11 }} color={r.judge_result.naked_judge === 'leak' ? 'red' : r.judge_result.naked_judge === 'safe' ? 'green' : 'orange'}>
                              {r.judge_result.naked_judge_display}
                            </Tag>
                          </span>
                          <span>
                            安全：
                            <Tag style={{ fontSize: 11 }} color={r.judge_result.hardened_judge === 'blocked' ? 'green' : r.judge_result.hardened_judge === 'unblocked' ? 'red' : 'orange'}>
                              {r.judge_result.hardened_judge_display}
                            </Tag>
                          </span>
                          {r.timestamp && (
                            <span style={{ color: '#999', fontSize: 11 }}>{r.timestamp}</span>
                          )}
                        </div>
                      ) : (
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '4px 8px',
                          borderRadius: 4,
                          fontSize: 12,
                          background: '#f0f0f0'
                        }}>
                          <Tag color={r.leak_detected ? 'red' : 'green'}>
                            {r.leak_detected ? '泄露' : '未泄露'}
                          </Tag>
                          <Tag color={r.hardened_result === 'pass' ? 'green' : 'red'}>
                            {r.hardened_result === 'pass' ? '拦截' : '未拦截'}
                          </Tag>
                        </div>
                      )}
                    </div>
                  )
                })()}
              </List.Item>
            )}
          />
        </Card>
      </Col>

      <Col span={16}>
        {selectedScenario && (
          <>
            <Card title={`🎯 场景 ${selectedScenario.id}: ${selectedScenario.name}`}>
              <Descriptions column={2} style={{ marginBottom: 16 }}>
                <Descriptions.Item label="风险等级">
                  <Tag color={getRiskColor(selectedScenario.risk_level)}>
                    {getRiskText(selectedScenario.risk_level)}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="安全特性">
                  <Tag color="blue">🔒 {selectedScenario.security_feature}</Tag>
                  {selectedScenario.sandbox_related && (
                    <Tag color="purple" style={{ marginLeft: 8 }}>🐳 Docker 沙箱</Tag>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="配置项" span={2}>
                  {selectedScenario.description}
                </Descriptions.Item>
              </Descriptions>

              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <h4 style={{ margin: 0 }}>📝 攻击提示词</h4>
                  <Space>
                    <Button
                      size="small"
                      icon={<RobotOutlined />}
                      onClick={openJudgeCriteriaEditor}
                    >
                      AI 评判标准
                    </Button>
                    <Button
                      size="small"
                      type={promptSaved ? 'default' : 'primary'}
                      onClick={savePrompt}
                    >
                      {promptSaved ? '✅ 已保存' : '💾 保存提示词'}
                    </Button>
                  </Space>
                </div>
                <TextArea
                  rows={6}
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  style={{ fontFamily: 'monospace' }}
                  placeholder="输入攻击提示词..."
                />
              </div>

              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={runTest}
                loading={loadingScenarios.has(selectedScenario.id)}
                size="large"
                block
              >
                对比测试：Unsafe-Carmind 和 Safe-Carmind
              </Button>
            </Card>
            
            {/* 显示当前场景的测试结果(如果存在) */}
            {(testResults.has(selectedScenario.id) || isMultiStage(selectedScenario)) && (
              <Card style={{ marginTop: 16 }}>
                <Tabs
                  activeKey={resultTab}
                  onChange={setResultTab}
                  destroyInactiveTabPane={false}
                  items={[
                    {
                      key: 'compare',
                      label: '对比视图',
                      children: testResults.has(selectedScenario.id) ? (
                        (() => {
                          const testResult = testResults.get(selectedScenario.id)!
                          return (
                            <>
                              {/* 异常状态醒目提示 */}
                              {(testResult.naked_result === 'error' || testResult.naked_result === 'timeout' ||
                                testResult.hardened_result === 'error' || testResult.hardened_result === 'timeout') && (
                                <Alert
                                  type="error"
                                  showIcon
                                  message="Gateway 通信异常"
                                  description="后端无法连接到 OpenClaw Gateway，请确认：1) Gateway 服务正在运行  2) LLM API Key 已正确配置  3) 网络连接正常"
                                  style={{ marginBottom: 16 }}
                                />
                              )}
                              <Row gutter={16}>
                                <Col span={12}>
                                  <Card
                                    title={
                                      <Space>
                                        <span>Unsafe-Carmind</span>
                                        <Tag color={testResult.naked_result === 'fail' ? 'red' : 'green'}>
                                          {testResult.naked_result === 'fail' ? '❌ 测试失败' : '✅ 测试通过'}
                                        </Tag>
                                      </Space>
                                    }
                                    size="small"
                                  >
                                    <pre style={{ 
                                      background: '#fff1f0', 
                                      padding: 12, 
                                      borderRadius: 4,
                                      maxHeight: 200,
                                      overflow: 'auto',
                                      fontSize: 12,
                                      whiteSpace: 'pre-wrap',
                                      wordBreak: 'break-word'
                                    }}>
                                      {testResult.naked_response || testResult.error || '无回复'}
                                    </pre>
                                  </Card>
                                </Col>
                                <Col span={12}>
                                  <Card
                                    title={
                                      <Space>
                                        <span>Safe-Carmind</span>
                                        <Tag color={testResult.hardened_result === 'pass' ? 'green' : 'red'}>
                                          {testResult.hardened_result === 'pass' ? '✅ 测试通过' : '❌ 测试失败'}
                                        </Tag>
                                      </Space>
                                    }
                                    size="small"
                                  >
                                    <pre style={{ 
                                      background: '#f6ffed', 
                                      padding: 12, 
                                      borderRadius: 4,
                                      maxHeight: 200,
                                      overflow: 'auto',
                                      fontSize: 12,
                                      whiteSpace: 'pre-wrap',
                                      wordBreak: 'break-word'
                                    }}>
                                      {testResult.hardened_response}
                                    </pre>
                                  </Card>
                                </Col>
                              </Row>
                              {/* 检测报告 */}
                              <Card type="inner" title="📋 检测报告" style={{ marginTop: 16 }}>
                                {testResult.judge_result && (
                                  <div style={{
                                    marginBottom: 16,
                                    padding: '12px 16px',
                                    borderRadius: 6,
                                    background: '#f6ffed',
                                    border: '1px solid #b7eb8f'
                                  }}>
                                    <Space align="start" style={{ marginBottom: 8 }}>
                                      <RobotOutlined style={{ fontSize: 18, color: '#52c41a' }} />
                                      <strong>AI 智能评判</strong>
                                    </Space>
                                    <div style={{ marginTop: 8 }}>
                                      <Space size="middle">
                                        <span>
                                          裸奔：
                                          <Tag color={testResult.judge_result.naked_judge === 'leak' ? 'red' : testResult.judge_result.naked_judge === 'safe' ? 'green' : 'orange'}>
                                            <span style={{ fontWeight: 'bold', fontSize: 14 }}>
                                              {testResult.judge_result.naked_judge_display}
                                            </span>
                                          </Tag>
                                        </span>
                                        <span>
                                          安全：
                                          <Tag color={testResult.judge_result.hardened_judge === 'blocked' ? 'green' : testResult.judge_result.hardened_judge === 'unblocked' ? 'red' : 'orange'}>
                                            <span style={{ fontWeight: 'bold', fontSize: 14 }}>
                                              {testResult.judge_result.hardened_judge_display}
                                            </span>
                                          </Tag>
                                        </span>
                                      </Space>
                                    </div>
                                    {testResult.judge_result.judge_reason && (
                                      <Paragraph
                                        style={{
                                          marginTop: 8,
                                          marginBottom: 0,
                                          padding: '8px 12px',
                                          background: '#fafafa',
                                          borderRadius: 4,
                                          fontSize: 12,
                                          fontStyle: 'italic',
                                          color: '#666'
                                        }}
                                      >
                                        💡 {testResult.judge_result.judge_reason}
                                      </Paragraph>
                                    )}
                                  </div>
                                )}
                              </Card>
                            </>
                          )
                        })()
                      ) : (
                        <Alert message="请先运行对比测试" type="info" showIcon />
                      ),
                    },
                    // 攻击链 Tab（仅多阶段场景显示）
                    ...(isMultiStage(selectedScenario) ? [{
                      key: 'attack-chain',
                      label: '攻击链',
                      children: (
                        <AttackChainView
                          data={attackChainDataMap.get(selectedScenario.id) ?? null}
                          loading={attackChainLoading}
                          defenseEnabled={defenseEnabled}
                          onDataChange={(updatedData) => handleAttackChainDataChange(selectedScenario.id, updatedData)}
                          onRetest={(promptOverrides) => handleAttackChainRetest(selectedScenario.id, promptOverrides)}
                        />
                      ),
                    }] : []),
                    // What-If Tab（仅多阶段场景显示）
                    ...(isMultiStage(selectedScenario) ? [{
                      key: 'whatif',
                      label: 'What-If',
                      children: (
                        <WhatIfPanel
                          scenarioId={selectedScenario.id}
                          onRetest={() => fetchAttackChain(selectedScenario.id)}
                          onDefenseChange={handleDefenseChange}
                        />
                      ),
                    }] : []),
                  ]}
                />
              </Card>
            )}
          </>
        )}
     </Col>
    </Row>
          ),
        },
      ]}
    />
    
    {/* AI 评判标准编辑 Modal */}
    <Modal
      title={
        <Space>
          <RobotOutlined />
          <span>AI 评判标准编辑 - {selectedScenario?.name}</span>
        </Space>
      }
      open={judgeCriteriaVisible}
      onCancel={() => setJudgeCriteriaVisible(false)}
      width={800}
      footer={
        <Space>
          <Button 
            icon={<ReloadOutlined />} 
            onClick={resetJudgeCriteria}
          >
            重置为默认
          </Button>
          <Button onClick={() => setJudgeCriteriaVisible(false)}>
            取消
          </Button>
          <Button type="primary" onClick={saveJudgeCriteria}>
            保存评判标准
          </Button>
        </Space>
      }
    >
      <div style={{ marginBottom: 12 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Alert
            type="info"
            showIcon
            icon={<InfoCircleOutlined />}
            message="这里配置 AI 评判该场景的标准。修改后将保存在服务端，覆盖默认值，支持随攻击提示词一样自由修改。"
          />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            结构说明：description=场景描述，scoring_rules=具体评分规则列表，leak_indicators=判定"泄露"的指标列表，block_indicators=判定"成功拦截"的指标列表
          </Typography.Text>
        </Space>
      </div>
      <TextArea
        rows={20}
        value={judgeCriteriaText}
        onChange={(e) => {
          setJudgeCriteriaText(e.target.value)
          setJudgeCriteriaChanged(true)
        }}
        style={{ fontFamily: 'monospace', fontSize: 13 }}
        placeholder="编辑 JSON 格式的评判标准..."
      />
      {judgeCriteriaChanged && (
        <div style={{ marginTop: 8, color: '#faad14' }}>
          ⚠️ 有未保存的修改
        </div>
      )}
    </Modal>
    </>
  )
}

export default Sandbox
