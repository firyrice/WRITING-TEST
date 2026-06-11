import { Link, NavLink, Outlet } from 'react-router-dom';
import { cn } from './ui/cn';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'px-3 py-1.5 text-sm rounded',
    isActive ? 'bg-brand text-white' : 'text-gray-700 hover:bg-gray-100'
  );

export function AppShell() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-gray-200">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-4 h-14">
          <Link to="/" className="font-semibold text-gray-900">
            ✍ 写作模型评测
          </Link>
          <nav className="flex gap-1">
            <NavLink to="/new" className={linkClass}>新建</NavLink>
            <NavLink to="/history" className={linkClass}>历史</NavLink>
            <NavLink to="/settings" className={linkClass}>设置</NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl w-full flex-1 px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
