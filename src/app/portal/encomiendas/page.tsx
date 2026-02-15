import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ParcelList, { Parcel } from "./ParcelList"; // Import Parcel Interface

export const metadata = {
  title: 'Mis Encomiendas - Chimivuelos',
  description: 'Rastrea tus envíos y paquetes.',
}

export default async function ParcelsPage() {
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
      .eq('type', 'parcel')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

  const termsContent = termsData?.content || "Términos y condiciones no disponibles.";
  const termsVersion = termsData?.version || "1.0";

  // 2. Fetch User Parcels
  // Ensure we match the interface: sender_id or recipient_id? Usually client is sender.
  // Assuming 'sender_id' links to profile.
  const { data: parcelsData, error } = await supabase
    .from("parcels")
    .select("*")
    .eq("sender_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
     console.error("Error fetching parcels:", error);
  }

  const parcels = (parcelsData || []) as unknown as Parcel[];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">
            Mis Encomiendas
        </h1>
        <p className="text-slate-500">
           Rastrea el estado de tus envíos en tiempo real.
        </p>
      </div>

      <ParcelList 
         parcels={parcels} 
         termsContent={termsContent} 
         termsVersion={termsVersion} 
      />
    </div>
  );
}
