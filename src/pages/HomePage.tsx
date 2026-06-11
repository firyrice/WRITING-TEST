import { Link } from 'react-router-dom';
import { useSettingsStore } from '@/state/settingsStore';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export function HomePage() {
  const { apiKey } = useSettingsStore((s) => s.settings);
  const hasKey = Boolean(apiKey);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">写作模型评测工具</h1>
      <p className="text-gray-600">
        让多个 AI 模型针对同一道题目作答，再用一个评测者模型横向打分、给出报告。
      </p>

      {!hasKey && (
        <Card className="bg-amber-50 border-amber-200">
          <CardBody className="flex items-center justify-between gap-4">
            <span className="text-sm text-amber-800">
              尚未配置 API Key，先去设置页面填一下吧。
            </span>
            <Link to="/settings">
              <Button variant="primary" size="sm">去设置</Button>
            </Link>
          </CardBody>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Link to="/new"><Card className="hover:bg-gray-50"><CardBody>
          <div className="text-2xl">📝</div>
          <div className="font-semibold mt-1">新建测试任务</div>
          <div className="text-sm text-gray-600 mt-1">填写作题目、勾选模型、开始测试。</div>
        </CardBody></Card></Link>
        <Link to="/history"><Card className="hover:bg-gray-50"><CardBody>
          <div className="text-2xl">📚</div>
          <div className="font-semibold mt-1">历史任务</div>
          <div className="text-sm text-gray-600 mt-1">查看以前的评测结果。</div>
        </CardBody></Card></Link>
        <Link to="/settings"><Card className="hover:bg-gray-50"><CardBody>
          <div className="text-2xl">⚙️</div>
          <div className="font-semibold mt-1">设置</div>
          <div className="text-sm text-gray-600 mt-1">API Key、默认 Prompt、默认模型。</div>
        </CardBody></Card></Link>
      </div>
    </div>
  );
}
