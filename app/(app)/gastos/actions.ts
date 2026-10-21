'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { parseWhole, type FormState } from '@/lib/form';
import { isValidDate } from '@/lib/time';
import { logActivity } from '@/lib/activity';

const BUCKET = 'receipts';
const MAX_BYTES = 4 * 1024 * 1024;
const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };

const text = (fd: FormData, key: string) => String(fd.get(key) ?? '').trim();
const refresh = () => revalidatePath('/gastos', 'layout');
const peso = (n: number) => '$' + n.toLocaleString('es-CO');

/** Los mensajes que escribimos en la base (código P0001) están en español y son seguros de mostrar. */
const friendly = (error: { code?: string; message: string }, fallback: string) =>
  error.code === 'P0001' ? error.message : fallback;

export async function saveExpense(_prev: FormState, fd: FormData): Promise<FormState> {
  const supabase = await requireAdmin();
  const id = text(fd, 'id');
  const date = text(fd, 'expense_date');
  const description = text(fd, 'description');
  const amount = parseWhole(fd.get('amount'));
  if (!isValidDate(date)) return { error: 'Elige la fecha del gasto.' };
  if (!description) return { error: 'Escribe una descripción del gasto.' };
  if (!amount) return { error: 'El monto debe ser un número mayor que 0.' };

  const [{ data: category }, { data: method }] = await Promise.all([
    supabase.from('expense_categories').select('id, name').eq('id', text(fd, 'category_id')).maybeSingle(),
    supabase.from('payment_methods').select('id, name').eq('id', text(fd, 'payment_method_id')).maybeSingle()
  ]);
  if (!category) return { error: 'Elige la categoría del gasto.' };
  if (!method) return { error: 'Elige el medio de pago.' };

  const file = fd.get('receipt');
  const hasFile = file instanceof File && file.size > 0;
  if (hasFile) {
    if (!TYPES[file.type]) return { error: 'El comprobante debe ser JPG, PNG, WebP o PDF.' };
    if (file.size > MAX_BYTES) return { error: 'El comprobante pesa más de 4 MB. Usa uno más liviano.' };
  }

  let existing: { status: string; receipt_path: string | null } | null = null;
  if (id) {
    const { data } = await supabase.from('expenses').select('status, receipt_path').eq('id', id).maybeSingle();
    existing = data;
    if (!existing) return { error: 'No se encontró el gasto.' };
    if (existing.status === 'anulado') return { error: 'Este gasto está anulado y no se puede editar.' };
  }

  const expenseId = id || crypto.randomUUID();
  let receiptPath: string | undefined;
  if (hasFile) {
    receiptPath = `${expenseId}/${Date.now()}.${TYPES[file.type]}`;
    const { error } = await supabase.storage.from(BUCKET).upload(receiptPath, file, { contentType: file.type });
    if (error) return { error: 'No se pudo subir el comprobante.' };
  }

  const row = {
    expense_date: date, category_id: category.id, category_name: category.name, description, amount,
    payment_method_id: method.id, payment_method_name: method.name,
    from_cash: fd.get('from_cash') === 'on', supplier: text(fd, 'supplier'),
    ...(receiptPath ? { receipt_path: receiptPath } : {})
  };

  const { error } = id
    ? await supabase.from('expenses').update(row).eq('id', id)
    : await supabase.from('expenses').insert({ id: expenseId, ...row });
  if (error) {
    if (receiptPath) await supabase.storage.from(BUCKET).remove([receiptPath]);
    return { error: friendly(error, 'No se pudo guardar el gasto.') };
  }
  if (receiptPath && existing?.receipt_path) await supabase.storage.from(BUCKET).remove([existing.receipt_path]);

  await logActivity(supabase, {
    action: id ? 'gasto.editado' : 'gasto.creado', entity: 'expense', entityId: expenseId,
    summary: `${id ? 'Editó' : 'Registró'} el gasto “${description}” (${peso(amount)}, ${category.name})`,
    details: { ...row, receipt: !!receiptPath }
  });

  refresh();
  if (!id) redirect('/gastos');
  return { ok: 'Gasto guardado.' };
}

export async function voidExpense(_prev: FormState, fd: FormData): Promise<FormState> {
  const supabase = await requireAdmin();
  const id = text(fd, 'id');
  const reason = text(fd, 'reason');
  if (!reason) return { error: 'Escribe el motivo de la anulación.' };

  const { data: e } = await supabase.from('expenses').select('description, amount, status').eq('id', id).maybeSingle();
  if (!e || e.status === 'anulado') return { error: 'El gasto no existe o ya está anulado.' };

  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from('expenses')
    .update({ status: 'anulado', void_reason: reason, voided_at: new Date().toISOString(), voided_by: userData.user?.id })
    .eq('id', id);
  if (error) return { error: friendly(error, 'No se pudo anular el gasto.') };

  await logActivity(supabase, {
    action: 'gasto.anulado', entity: 'expense', entityId: id,
    summary: `Anuló el gasto “${e.description}” (${peso(e.amount)})`, details: { reason }
  });
  refresh();
  return { ok: 'Gasto anulado.' };
}
