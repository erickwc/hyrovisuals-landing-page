import en from '../i18n/en.json';
import es from '../i18n/es.json';
import { supabase } from '../lib/supabase';

type Role = 'customer' | 'admin';
type Purchase = {
  order_id: string;
  product_name: string;
  paid_at: string | null;
  amount_cents: number;
  currency: string;
};
type Customer = {
  customer_id: string;
  display_name: string | null;
  email: string | null;
  role: Role;
  created_at: string;
  purchases: Purchase[];
};

export function initAdminPage() {
  const root = document.querySelector<HTMLElement>('[data-admin-root]');
  if (!root) return () => {};
  const controller = new AbortController();
  const { signal } = controller;
  const status = root.querySelector<HTMLElement>('[data-admin-status]')!;
  const content = root.querySelector<HTMLElement>('[data-admin-content]')!;
  const count = root.querySelector<HTMLElement>('[data-admin-count]')!;
  const list = root.querySelector<HTMLElement>('[data-admin-list]')!;
  let customers: Customer[] = [];
  let currentUserId: string | null = null;
  let message: keyof typeof en | null = 'adminLoading';
  const words = () => document.documentElement.lang === 'es' ? es : en;
  const date = (value: string | null) => value
    ? new Intl.DateTimeFormat(document.documentElement.lang, { dateStyle: 'medium' }).format(new Date(value))
    : '';
  const setMessage = (key: keyof typeof en | null) => {
    message = key;
    status.hidden = !key;
    status.textContent = key ? words()[key] : '';
  };
  const el = (tag: string, className: string, value?: string) => {
    const node = document.createElement(tag);
    node.className = className;
    if (value !== undefined) node.textContent = value;
    return node;
  };

  const render = () => {
    if (signal.aborted) return;
    list.replaceChildren();
    const w = words();
    count.textContent = `${customers.length} ${customers.length === 1 ? w.adminCustomerSingular : w.adminCustomerPlural}`;
    if (customers.length === 0) list.append(el('p', 'admin-empty', w.adminNoCustomers));
    customers.forEach((customer) => {
      const card = el('article', 'admin-customer');
      const top = el('div', 'admin-customer-top');
      const identity = el('div', 'admin-customer-identity');
      identity.append(el('h3', '', customer.display_name || w.adminUnnamed));
      identity.append(el('p', 'admin-customer-email', customer.email || '—'));
      identity.append(el('p', 'admin-customer-date', `${w.adminJoined} ${date(customer.created_at)}`));
      top.append(identity);

      const roleBox = el('div', 'admin-role');
      const label = el('label', '', w.adminRole);
      const select = document.createElement('select');
      select.id = `role-${customer.customer_id}`;
      select.setAttribute('aria-label', `${w.adminRole}: ${customer.display_name || customer.email || customer.customer_id}`);
      (['customer', 'admin'] as const).forEach((role) => {
        const option = document.createElement('option');
        option.value = role;
        option.textContent = role === 'admin' ? w.adminRoleAdmin : w.adminRoleCustomer;
        select.append(option);
      });
      select.value = customer.role;
      select.disabled = customer.customer_id === currentUserId;
      label.setAttribute('for', select.id);
      const save = el('button', 'admin-save', w.adminSave) as HTMLButtonElement;
      save.type = 'button';
      save.disabled = select.disabled || select.value === customer.role;
      select.addEventListener('change', () => { save.disabled = select.value === customer.role; }, { signal });
      save.addEventListener('click', async () => {
        const nextRole = select.value as Role;
        if (!supabase || nextRole === customer.role || save.disabled) return;
        save.disabled = true;
        select.disabled = true;
        setMessage('adminSaving');
        const { error } = await supabase.rpc('admin_set_customer_role', {
          target_user_id: customer.customer_id,
          new_role: nextRole,
        });
        if (signal.aborted) return;
        if (error) {
          select.value = customer.role;
          setMessage('adminSaveError');
        } else {
          customer.role = nextRole;
          setMessage('adminSaved');
        }
        select.disabled = false;
        save.disabled = true;
      }, { signal });
      roleBox.append(label, select, save);
      top.append(roleBox);
      card.append(top);

      const purchases = el('div', 'admin-purchases');
      purchases.append(el('h4', '', w.adminPurchases));
      if (customer.purchases.length === 0) {
        purchases.append(el('p', 'admin-empty', w.adminNoPurchases));
      } else {
        const purchaseList = el('ul', 'admin-purchase-list');
        customer.purchases.forEach((purchase) => {
          const item = el('li', '');
          item.append(el('span', '', purchase.product_name));
          item.append(el('small', '', date(purchase.paid_at)));
          purchaseList.append(item);
        });
        purchases.append(purchaseList);
      }
      card.append(purchases);
      list.append(card);
    });
  };

  const load = async () => {
    if (!supabase) return setMessage('accountConfigError');
    setMessage('adminLoading');
    content.hidden = true;
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (signal.aborted) return;
    if (userError || !userData.user) return setMessage('adminSignIn');
    currentUserId = userData.user.id;
    const { data, error } = await supabase.rpc('admin_list_customers');
    if (signal.aborted) return;
    if (error?.code === '42501') return setMessage('adminForbidden');
    if (error) return setMessage('adminLoadError');
    customers = (data || []) as Customer[];
    content.hidden = false;
    setMessage(null);
    render();
  };

  const subscription = supabase?.auth.onAuthStateChange((event) => {
    if (event !== 'INITIAL_SESSION' && !signal.aborted) void load();
  });
  document.addEventListener('hyro:language', () => {
    if (message) setMessage(message);
    if (!content.hidden) render();
  }, { signal });
  void load();
  return () => {
    controller.abort();
    subscription?.data.subscription.unsubscribe();
  };
}
