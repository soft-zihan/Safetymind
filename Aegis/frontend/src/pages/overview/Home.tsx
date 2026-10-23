import { Image } from 'antd'

export default function Home() {
  return (
    <div style={{ textAlign: 'center', padding: '20px' }}>
      <Image
        src="/ppts/overview/slide_1.png"
        alt="Safetymind 原型系统总览"
        style={{ maxWidth: '100%', height: 'auto' }}
        preview={false}
      />
    </div>
  )
}
