import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchClients, type ClientRow } from "../../lib/admin-data";
import { formatMoney, formatDate } from "./periods";
import { Pager, TableSearch } from "./shared";
import { Users } from "../../components/animate-ui/icons/hugeicons/users";
import { ShoppingCart } from "../../components/animate-ui/icons/hugeicons/shopping-cart";
import { Wallet } from "../../components/animate-ui/icons/hugeicons/wallet";
import { ChartColumn } from "../../components/animate-ui/icons/hugeicons/chart-column";
import { UserRound } from "../../components/animate-ui/icons/hugeicons/user-round";

type Status = "loading" | "ready" | "error";
const PAGE_SIZE = 12;

export function Clients() {
  const [rows, setRows] = useState<ClientRow[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchClients()
      .then((data) => {
        setRows(data);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, []);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return needle ? rows.filter((r) => r.email.toLowerCase().includes(needle) || (r.name ?? "").toLowerCase().includes(needle)) : rows;
  }, [rows, search]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const buyers = rows.filter((r) => r.purchaseCount > 0).length;
  const totalSpent = Math.round(rows.reduce((a, r) => a + r.totalSpent, 0) * 100) / 100;
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="admin__page">
      <div className="admin__head">
        <h1 className="admin__title">Clientes</h1>
      </div>

      <div className="admin__content">
        <div className="board">
          <div className="board__kpis">
            <div className="kpi">
              <p className="kpi__label">
                <Users size={14} />
                Usuarios registrados
              </p>
              <p className="kpi__value">{rows.length}</p>
              <p className="kpi__foot">Cuentas creadas en la web</p>
            </div>
            <div className="kpi">
              <p className="kpi__label">
                <ShoppingCart size={14} />
                Compradores
              </p>
              <p className="kpi__value">{buyers}</p>
              <p className="kpi__foot">
                {rows.length ? (
                  <>
                    <span className="kpi__delta">{Math.round((buyers / rows.length) * 100)}%</span> de los registrados
                  </>
                ) : (
                  "Sin registros todavía"
                )}
              </p>
            </div>
            <div className="kpi">
              <p className="kpi__label">
                <Wallet size={14} />
                Total vendido
              </p>
              <p className="kpi__value">{formatMoney(totalSpent)}</p>
              <p className="kpi__foot">Compras pagadas de todos los clientes</p>
            </div>
            <div className="kpi">
              <p className="kpi__label">
                <ChartColumn size={14} />
                Gasto promedio
              </p>
              <p className="kpi__value">{formatMoney(buyers ? totalSpent / buyers : 0)}</p>
              <p className="kpi__foot">Por comprador</p>
            </div>
          </div>
        </div>

        <div className="board">
          <div className="board__toolbar">
            <p className="board__title">
              Todos los clientes <span className="board__count">{filtered.length}</span>
            </p>
          </div>
          <div className="board__filterbar">
            <TableSearch value={search} onChange={setSearch} placeholder="Buscar por nombre o correo" />
            <Pager page={page} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} />
          </div>

          {status === "loading" && <p className="board__empty">Cargando clientes…</p>}
          {status === "error" && <p className="board__empty">No pudimos cargar los clientes.</p>}
          {status === "ready" && filtered.length === 0 && <p className="board__empty">Sin resultados.</p>}

          {status === "ready" && filtered.length > 0 && (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th className="client-cell__photo">Foto</th>
                    <th>Nombre</th>
                    <th>Correo</th>
                    <th className="is-num">Compras</th>
                    <th className="is-num">Total gastado</th>
                    <th>Última compra</th>
                    <th>Registrado</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((row) => (
                    <tr key={row.id}>
                      <td className="client-cell__photo">
                        <span className="client-avatar">{row.avatarUrl ? <img src={row.avatarUrl} alt="" loading="lazy" /> : <UserRound size={13} />}</span>
                      </td>
                      <td>
                        {row.name ? (
                          <Link className="table-link" to={`/admin/clientes/${row.id}`}>
                            {row.name}
                          </Link>
                        ) : (
                          <span className="is-muted">Sin nombre</span>
                        )}
                      </td>
                      <td>
                        <Link className={row.name ? "table-link is-muted" : "table-link"} to={`/admin/clientes/${row.id}`}>
                          {row.email}
                        </Link>
                      </td>
                      <td className="is-num">{row.purchaseCount}</td>
                      <td className="is-num">{formatMoney(row.totalSpent)}</td>
                      <td className={row.lastPurchaseAt ? undefined : "is-muted"}>{row.lastPurchaseAt ? formatDate(row.lastPurchaseAt) : "Sin compras"}</td>
                      <td className="is-muted">{formatDate(row.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
