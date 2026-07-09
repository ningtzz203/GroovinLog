import Link from "next/link";
import { Icon, IconName } from "./icons";

export function AppShell({ children, active }: { children: React.ReactNode; active: string }) {
  const items: { href: string; label: string; icon: IconName }[] = [
    { href: "/", label: "首页", icon: "home" },
    { href: "/add-class", label: "课程复盘", icon: "plus" },
    { href: "/practice", label: "练习", icon: "practice" },
    { href: "/weekly-review", label: "本周复盘", icon: "review" },
  ];
  return <div className="app-shell"><main>{children}</main><nav className="bottom-nav" aria-label="主导航">{items.map(item => <Link key={item.href} href={item.href} className={active === item.href ? "active" : ""}><span className="nav-icon"><Icon name={item.icon} /></span><span>{item.label}</span></Link>)}</nav></div>;
}

export function Header({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: React.ReactNode }) {
  return <header className="page-header"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1></div>{action}</header>;
}

export function SectionTitle({ children, link }: { children: React.ReactNode; link?: string }) {
  return <div className="section-title"><h2>{children}</h2>{link && <Link href={link}>查看全部 <Icon name="arrow" size={16} /></Link>}</div>;
}

export function EmptyState({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  return <div className="empty-state"><span><Icon name={icon} size={28} /></span><h3>{title}</h3><p>{text}</p></div>;
}
