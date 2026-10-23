import { useState, useEffect } from 'react'
import { Card, Table, Tag, Row, Col, Statistic, Button, Drawer, Empty, Spin } from 'antd'
import { DatabaseOutlined } from '@ant-design/icons'
import axios from 'axios'
import { API_BASE, type DatasetInfo, type Sample, labelColor } from './shared'

export default function DatasetsTab() {
  const [datasets, setDatasets] = useState<DatasetInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDs, setSelectedDs] = useState<DatasetInfo | null>(null)
  const [samples, setSamples] = useState<Sample[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [detailSample, setDetailSample] = useState<Sample | null>(null)

  const loadDatasets = async () => {
    setLoading(true)
    try {
      const res = await axios.get(`${API_BASE}/datasets`)
      setDatasets(res.data.datasets || [])
    } catch { setDatasets([]) }
    finally { setLoading(false) }
  }

  const loadSamples = async (ds: DatasetInfo, p: number = 1) => {
    setSelectedDs(ds); setSamples([])
    try {
      const res = await axios.get(`${API_BASE}/datasets/${ds.id}/samples`, { params: { page: p, page_size: 20 } })
      setSamples(res.data.samples || []); setTotal(res.data.total_samples || 0); setPage(p)
    } catch { setSamples([]) }
  }

  useEffect(() => { loadDatasets() }, [])

  return (
    <div>
      {loading ? <Spin /> : (
        <Row gutter={16}>
          <Col span={8}>
            <Card title={<><DatabaseOutlined /> Datasets</>} size="small">
              {datasets.map(ds => (
                <Card.Grid key={ds.id} style={{ width: '100%', padding: '8px 16px', cursor: 'pointer' }}
                  onClick={() => loadSamples(ds)}
                  hoverable>
                  <Row justify="space-between" align="middle">
                    <Col>
                      <strong>{ds.name}</strong>
                      <div style={{ fontSize: 11, color: '#999' }}>{ds.type} / {ds.split}</div>
                    </Col>
                    <Col><Statistic value={ds.count} valueStyle={{ fontSize: 18 }} /></Col>
                  </Row>
                  {ds.labels && (
                    <div style={{ marginTop: 4 }}>
                      {Object.entries(ds.labels).map(([k, v]) => (
                        <Tag key={k} color={labelColor(k)} style={{ fontSize: 10 }}>{k}: {v}</Tag>
                      ))}
                    </div>
                  )}
                </Card.Grid>
              ))}
              {datasets.length === 0 && <Empty />}
            </Card>
          </Col>
          <Col span={16}>
            <Card title={selectedDs ? `${selectedDs.name} - Samples` : 'Select a dataset'} size="small">
              {selectedDs && selectedDs.sources && (
                <div style={{ marginBottom: 12 }}>
                  <span>Sources: </span>
                  {Object.entries(selectedDs.sources).map(([k, v]) => (
                    <Tag key={k}>{k}: {v}</Tag>
                  ))}
                </div>
              )}
              {selectedDs ? (
              <Table dataSource={samples} rowKey={(_, i) => `s-${i}`} size="small"
                pagination={{ current: page, pageSize: 20, total, showTotal: (t) => `${t} samples` }}
                onChange={(p) => selectedDs && loadSamples(selectedDs, p.current || 1)}
                columns={[
                  { title: 'Prompt', dataIndex: 'prompt', key: 'prompt', ellipsis: true, width: 200,
                    render: (v: string) => <code style={{ fontSize: 11 }}>{(v || '').slice(0, 80)}</code> },
                  { title: 'Response', dataIndex: 'response', key: 'resp', ellipsis: true, width: 200,
                    render: (v: string) => v ? <code style={{ fontSize: 11 }}>{v.slice(0, 80)}</code> : '—' },
                  { title: 'Label', key: 'label', width: 90,
                    render: (r: any) => {
                      const label = r.safety_label || r.labels_text || r.label || '—'
                      return <Tag color={labelColor(label)}>{label}</Tag>
                    } },
                  { title: 'Source', dataIndex: 'source', key: 'src', width: 80 },
                  { title: '', key: 'detail', width: 60,
                    render: (r: any) => <Button size="small" type="link" onClick={() => setDetailSample(r)}>Detail</Button> },
                ]}
              />
              ) : (
                <Empty description="← Click a dataset on the left to browse samples" style={{ margin: '60px 0' }} />
              )}
            </Card>
          </Col>
        </Row>
      )}

      <Drawer title="Sample Detail" open={!!detailSample} onClose={() => setDetailSample(null)} width={600}>
        {detailSample && (
          <pre style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>{JSON.stringify(detailSample, null, 2)}</pre>
        )}
      </Drawer>
    </div>
  )
}
