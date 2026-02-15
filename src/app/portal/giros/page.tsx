import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import TransferList, { MoneyTransfer } from "./TransferList";

export const metadata = {
  title: 'Mis Giros - Chimivuelos',
  description: 'Historial de tus envíos de dinero.',
}

export default async function TransfersPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/login");
  }

  // 1. Fetch Latest Terms
  const { data: termsData } = await supabase
      .from('legal_terms')
      .select('content, version')
      .eq('type', 'transfer')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

  const termsContent = termsData?.content || "Términos y condiciones no disponibles.";
  const termsVersion = termsData?.version || "1.0";

  // 2. Fetch User Transfers
  const { data: transfersData, error } = await supabase
    .from("money_transfers")
    .select("*")
    .eq("client_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
     console.error("Error fetching transfers:", error);
  }

  const transfers = (transfersData || []) as unknown as MoneyTransfer[];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">
            Mis Giros
        </h1>
        <p className="text-slate-500">
           Consulta el estado y descarga los comprobantes de tus giros.
        </p>
      </div>

      <TransferList 
         transfers={transfers} 
         termsContent={termsContent} 
         termsVersion={termsVersion} 
      />
    </div>
  );
}
