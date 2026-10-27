// Text alternative for charts: DESIGN_SYSTEM.md §5 "Chart" requires the
// values to be readable without hover or colour.
export default function DataTable({
  caption,
  headers,
  rows,
}: {
  caption: string;
  headers: [string, string];
  rows: [string, string][];
}) {
  return (
    <details className="chart-data">
      <summary>ดูข้อมูลเป็นตาราง</summary>
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{headers[0]}</th>
            <th scope="col">{headers[1]}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([a, b]) => (
            <tr key={a}>
              <th scope="row">{a}</th>
              <td>{b}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
