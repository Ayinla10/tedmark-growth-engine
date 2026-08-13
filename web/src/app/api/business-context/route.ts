import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentAgencyId } from "@/lib/agency";

export async function POST(req: Request) {
  try {
    const agencyId = await getCurrentAgencyId();
    const body = await req.json();

    const {
      business_name, industry, business_model,
      products, services, pricing, location,
      target_markets, icp, customer_segments,
      acquisition_channels, sales_channels,
      website, social_media, communication_channels,
      constraints, budget, goals,
    } = body;

    await pool.query(
      `INSERT INTO business_context (
        agency_id, business_name, industry, business_model,
        products, services, pricing, location,
        target_markets, icp, customer_segments,
        acquisition_channels, sales_channels,
        website, social_media, communication_channels,
        constraints, budget, goals, updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,now()
      )
      ON CONFLICT (agency_id) DO UPDATE SET
        business_name = EXCLUDED.business_name,
        industry = EXCLUDED.industry,
        business_model = EXCLUDED.business_model,
        products = EXCLUDED.products,
        services = EXCLUDED.services,
        pricing = EXCLUDED.pricing,
        location = EXCLUDED.location,
        target_markets = EXCLUDED.target_markets,
        icp = EXCLUDED.icp,
        customer_segments = EXCLUDED.customer_segments,
        acquisition_channels = EXCLUDED.acquisition_channels,
        sales_channels = EXCLUDED.sales_channels,
        website = EXCLUDED.website,
        social_media = EXCLUDED.social_media,
        communication_channels = EXCLUDED.communication_channels,
        constraints = EXCLUDED.constraints,
        budget = EXCLUDED.budget,
        goals = EXCLUDED.goals,
        updated_at = now()`,
      [
        agencyId, business_name ?? null, industry ?? null, business_model ?? null,
        products ?? [], services ?? [], pricing ?? null, location ?? null,
        target_markets ?? [], icp ?? null, customer_segments ?? [],
        acquisition_channels ?? [], sales_channels ?? [],
        website ?? null, JSON.stringify(social_media ?? {}), communication_channels ?? [],
        constraints ?? null, budget ?? null, goals ?? null,
      ]
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[business-context] save failed:", err);
    return NextResponse.json({ error: "Save failed" }, { status: 500 });
  }
}
