import { ChevronDown, Columns3, Download, FileDown, Filter, MoreHorizontal, Plus, Printer, RefreshCw, Search, Upload } from "lucide-react";
import Link from "next/link";

type ToolbarAction = {
  label: string;
  href?: string;
  icon?: "add" | "import" | "export" | "print" | "template" | "refresh" | "filter" | "columns" | "more";
  primary?: boolean;
};

type BulkAction = {
  label: string;
  href: string;
};

const iconMap = {
  add: Plus,
  import: Upload,
  export: FileDown,
  print: Printer,
  template: Download,
  refresh: RefreshCw,
  filter: Filter,
  columns: Columns3,
  more: MoreHorizontal
};

function isDownloadHref(href?: string) {
  return Boolean(href?.startsWith("/api/") || href?.startsWith("http"));
}

export function TableToolbar({ title, count, actions = [], searchPlaceholder = "Search" }: { title: string; count?: string; actions?: ToolbarAction[]; searchPlaceholder?: string }) {
  return (
    <div className="table-toolbar">
      <div className="toolbar-title">
        <h1 className="page-title">{title}</h1>
        {count ? <span className="status">{count}</span> : null}
      </div>
      <div className="toolbar-actions">
        {actions.map((action) => {
          const Icon = iconMap[action.icon ?? "more"];
          const className = action.primary ? "button" : "button secondary";
          return action.href ? isDownloadHref(action.href) ? (
            <a key={action.label} className={className} href={action.href}>
              <Icon size={16} /> {action.label}
            </a>
          ) : (
            <Link key={action.label} className={className} href={action.href}>
              <Icon size={16} /> {action.label}
            </Link>
          ) : (
            <button key={action.label} className={className} type="button">
              <Icon size={16} /> {action.label}
            </button>
          );
        })}
        <form className="search-box">
          <Search size={16} />
          <input name="search" placeholder={searchPlaceholder} />
        </form>
      </div>
    </div>
  );
}

export function BulkActionBar({ actions }: { actions: BulkAction[] }) {
  return (
    <div className="bulk-bar">
      <span className="muted">Bulk actions</span>
      {actions.map((action) => (
        isDownloadHref(action.href) ? (
          <a className="button secondary" href={action.href} key={action.label}>{action.label}</a>
        ) : (
          <Link className="button secondary" href={action.href} key={action.label}>{action.label}</Link>
        )
      ))}
    </div>
  );
}

export function RowActionMenu({ actions }: { actions: Array<{ label: string; href?: string; danger?: boolean }> }) {
  return (
    <details className="row-actions">
      <summary><MoreHorizontal size={18} /><span>Actions</span><ChevronDown size={14} /></summary>
      <div className="row-menu">
        {actions.map((action) => action.href ? isDownloadHref(action.href) ? (
          <a key={action.label} className={action.danger ? "danger-action" : ""} href={action.href}>{action.label}</a>
        ) : (
          <Link key={action.label} className={action.danger ? "danger-action" : ""} href={action.href}>{action.label}</Link>
        ) : (
          <button key={action.label} className={action.danger ? "danger-action" : ""} type="button">{action.label}</button>
        ))}
      </div>
    </details>
  );
}
