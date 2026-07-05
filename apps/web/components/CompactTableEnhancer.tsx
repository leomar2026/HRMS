"use client";

import { useEffect } from "react";

function csvEscape(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

export function CompactTableEnhancer() {
  useEffect(() => {
    const tables = Array.from(document.querySelectorAll<HTMLTableElement>(".table-wrap table:not([data-compact-enhanced])"));

    for (const table of tables) {
      table.dataset.compactEnhanced = "true";
      const wrap = table.closest<HTMLElement>(".table-wrap");
      if (!wrap) continue;
      const headers = Array.from(table.querySelectorAll<HTMLTableCellElement>("thead th"));
      const body = table.querySelector("tbody");
      if (!body || headers.length === 0) continue;

      const selectTh = document.createElement("th");
      selectTh.className = "select-col";
      selectTh.innerHTML = '<input type="checkbox" aria-label="Select all rows" />';
      table.querySelector("thead tr")?.prepend(selectTh);

      Array.from(body.querySelectorAll("tr")).forEach((row) => {
        const cell = document.createElement("td");
        cell.className = "select-col";
        cell.innerHTML = '<input type="checkbox" aria-label="Select row" />';
        row.prepend(cell);
      });

      const toolbar = document.createElement("div");
      toolbar.className = "compact-table-controls";
      toolbar.innerHTML = `
        <div class="compact-table-left">
          <select class="compact-filter" aria-label="Filter records"><option value="">All records</option></select>
          <select class="compact-page-size" aria-label="Rows per page"><option>10</option><option selected>25</option><option>50</option><option>100</option></select>
        </div>
        <div class="compact-table-right">
          <button type="button" class="button secondary compact-export">Export</button>
          <button type="button" class="button secondary compact-print">Print</button>
          <button type="button" class="button secondary compact-refresh">Refresh</button>
          <input class="compact-search" placeholder="Search here..." />
        </div>
      `;
      wrap.before(toolbar);

      const pager = document.createElement("div");
      pager.className = "compact-table-pager";
      pager.innerHTML = `
        <span class="compact-count"></span>
        <div class="actions">
          <button type="button" class="button secondary compact-prev">Previous</button>
          <span class="compact-page"></span>
          <button type="button" class="button secondary compact-next">Next</button>
        </div>
      `;
      wrap.after(pager);

      const rows = Array.from(body.querySelectorAll<HTMLTableRowElement>("tr"));
      const search = toolbar.querySelector<HTMLInputElement>(".compact-search");
      const pageSize = toolbar.querySelector<HTMLSelectElement>(".compact-page-size");
      const filter = toolbar.querySelector<HTMLSelectElement>(".compact-filter");
      const count = pager.querySelector<HTMLElement>(".compact-count");
      const page = pager.querySelector<HTMLElement>(".compact-page");
      const prev = pager.querySelector<HTMLButtonElement>(".compact-prev");
      const next = pager.querySelector<HTMLButtonElement>(".compact-next");
      let currentPage = 1;

      const statusIndex = headers.findIndex((header) => header.textContent?.trim().toLowerCase() === "status") + 1;
      if (filter && statusIndex > 0) {
        const values = Array.from(new Set(rows.map((row) => row.children[statusIndex]?.textContent?.trim()).filter(Boolean) as string[]));
        values.forEach((value) => {
          const option = document.createElement("option");
          option.value = value;
          option.textContent = value;
          filter.append(option);
        });
      } else if (filter) {
        filter.disabled = true;
      }

      function matchingRows() {
        const query = search?.value.trim().toLowerCase() ?? "";
        const selectedFilter = filter?.value ?? "";
        return rows.filter((row) => {
          const text = row.textContent?.toLowerCase() ?? "";
          const matchesQuery = !query || text.includes(query);
          const matchesFilter = !selectedFilter || row.children[statusIndex]?.textContent?.trim() === selectedFilter;
          return matchesQuery && matchesFilter;
        });
      }

      function render() {
        const filtered = matchingRows();
        const size = Number(pageSize?.value ?? 25);
        const totalPages = Math.max(1, Math.ceil(filtered.length / size));
        currentPage = Math.min(currentPage, totalPages);
        const start = (currentPage - 1) * size;
        const visible = new Set(filtered.slice(start, start + size));
        rows.forEach((row) => {
          row.style.display = visible.has(row) ? "" : "none";
        });
        if (count) count.textContent = filtered.length ? `Total records: ${filtered.length}` : "No records found.";
        if (page) page.textContent = `Page ${currentPage} of ${totalPages}`;
        if (prev) prev.disabled = currentPage <= 1;
        if (next) next.disabled = currentPage >= totalPages;
      }

      search?.addEventListener("input", () => {
        currentPage = 1;
        render();
      });
      filter?.addEventListener("change", () => {
        currentPage = 1;
        render();
      });
      pageSize?.addEventListener("change", () => {
        currentPage = 1;
        render();
      });
      prev?.addEventListener("click", () => {
        currentPage = Math.max(1, currentPage - 1);
        render();
      });
      next?.addEventListener("click", () => {
        currentPage += 1;
        render();
      });

      headers.forEach((header, index) => {
        header.dataset.sortable = "true";
        header.addEventListener("click", () => {
          const direction = header.dataset.sortDirection === "asc" ? -1 : 1;
          header.dataset.sortDirection = direction === 1 ? "asc" : "desc";
          rows.sort((a, b) => ((a.children[index + 1]?.textContent ?? "").localeCompare(b.children[index + 1]?.textContent ?? "")) * direction);
          rows.forEach((row) => body.append(row));
          render();
        });
      });

      toolbar.querySelector(".compact-export")?.addEventListener("click", () => {
        const visibleRows = matchingRows();
        const csv = [
          headers.map((header) => csvEscape(header.textContent?.trim() ?? "")).join(","),
          ...visibleRows.map((row) => Array.from(row.children).slice(1).map((cell) => csvEscape(cell.textContent?.trim() ?? "")).join(","))
        ].join("\n");
        const link = document.createElement("a");
        link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
        link.download = "hrms-export.csv";
        link.click();
        URL.revokeObjectURL(link.href);
      });
      toolbar.querySelector(".compact-print")?.addEventListener("click", () => window.print());
      toolbar.querySelector(".compact-refresh")?.addEventListener("click", () => window.location.reload());
      table.querySelector<HTMLInputElement>('thead input[type="checkbox"]')?.addEventListener("change", (event) => {
        const checked = (event.currentTarget as HTMLInputElement).checked;
        Array.from(body.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')).forEach((checkbox) => {
          checkbox.checked = checked;
        });
      });

      render();
    }
  }, []);

  return null;
}
