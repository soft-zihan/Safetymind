import { Steps, Button, Space } from 'antd';
import { PlayCircleOutlined, StopOutlined } from '@ant-design/icons';

interface TaskStep {
  title: string;
  description?: string;
  status: 'wait' | 'process' | 'finish' | 'error';
}

interface TaskProgressProps {
  steps: TaskStep[];
  running: boolean;
  onRun?: () => void;
  onStop?: () => void;
}

export default function TaskProgress({ steps, running, onRun, onStop }: TaskProgressProps) {
  return (
    <div>
      <Steps
        current={steps.findIndex((s) => s.status === 'process')}
        items={steps}
        style={{ marginBottom: 24 }}
      />
      <Space>
        <Button
          type="primary"
          icon={<PlayCircleOutlined />}
          onClick={onRun}
          disabled={running}
        >
          开始执行
        </Button>
        <Button
          danger
          icon={<StopOutlined />}
          onClick={onStop}
          disabled={!running}
        >
          停止
        </Button>
      </Space>
    </div>
  );
}
