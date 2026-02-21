"use client";

import { useState, useEffect, KeyboardEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCompany } from "@/contexts/CompanyContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AvatarUpload } from "@/components/shared/avatar-upload";
import { LocationPicker, LocationValue } from "@/components/shared/location-picker";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  FiBriefcase, FiMapPin, FiGlobe, FiFileText,
  FiUsers, FiStar, FiEdit2, FiSave, FiX, FiPhone, FiMail, FiShield,
} from "react-icons/fi";

/* ─── Types ─── */
interface IExtProfile {
  bio: string;
  address: { street: string; city: string; state: string; zipCode: string; country: string; lat: number | null; lng: number | null; displayName: string; };
  website: string;
  gstNumber: string;
  panNumber: string;
  yearEstablished: number;
  employeeCount: number;
  socialLinks: { linkedin: string; facebook: string; instagram: string; twitter: string };
  languages: string[];
}

const defaultExt: IExtProfile = {
  bio: "",
  address: { street: "", city: "", state: "", zipCode: "", country: "", lat: null, lng: null, displayName: "" },
  website: "",
  gstNumber: "",
  panNumber: "",
  yearEstablished: new Date().getFullYear(),
  employeeCount: 1,
  socialLinks: { linkedin: "", facebook: "", instagram: "", twitter: "" },
  languages: [],
};

/* ─── Sub-components ─── */
function ProfileField({ icon: Icon, label, value, className }: {
  icon: React.ElementType; label: string; value?: string | null; className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3 py-2.5 border-b border-border/50 last:border-0", className)}>
      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground truncate">{value || "—"}</p>
      </div>
    </div>
  );
}

function CardSection({ icon: Icon, title, description, accent = "violet", children }: {
  icon: React.ElementType; title: string; description?: string; accent?: string; children: React.ReactNode;
}) {
  const accents: Record<string, string> = {
    violet:  "bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400",
    indigo:  "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400",
    emerald: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
    amber:   "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
    blue:    "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
    rose:    "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400",
    cyan:    "bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400",
  };
  return (
    <Card className="rounded-2xl border shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm", accents[accent] ?? accents.violet)}>
            <Icon className="h-4.5 w-4.5" />
          </div>
          <div>
            <CardTitle className="text-sm font-bold">{title}</CardTitle>
            {description && <CardDescription className="text-xs mt-0.5">{description}</CardDescription>}
          </div>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function TagList({ tags }: { tags: string[] }) {
  if (!tags || tags.length === 0) return <p className="text-sm text-muted-foreground italic">—</p>;
  return <div className="flex flex-wrap gap-1.5">{tags.map(t => <Badge key={t} variant="secondary" className="text-xs px-2.5 py-0.5 rounded-full font-medium">{t}</Badge>)}</div>;
}

function TagInput({ tags, onChange, placeholder, id }: {
  tags: string[]; onChange: (t: string[]) => void; placeholder?: string; id: string;
}) {
  const [input, setInput] = useState("");
  const add = (val: string) => {
    const v = val.trim().replace(/,$/, "").trim();
    if (v && !tags.includes(v)) onChange([...tags, v]);
    setInput("");
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(input); }
    else if (e.key === "Backspace" && !input && tags.length > 0) onChange(tags.slice(0, -1));
  };
  return (
    <div
      className="flex flex-wrap gap-1.5 items-center min-h-10 px-3 py-2 rounded-md border bg-background focus-within:ring-2 focus-within:ring-ring transition-shadow cursor-text"
      onClick={() => document.getElementById(id)?.focus()}
    >
      {tags.map(t => (
        <span key={t} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
          {t}
          <button type="button" onClick={e => { e.stopPropagation(); onChange(tags.filter(x => x !== t)); }} className="hover:text-destructive transition-colors">
            <FiX className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}
      <input id={id} value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKey}
        onBlur={() => input && add(input)}
        placeholder={tags.length === 0 ? (placeholder ?? "Type and press Enter") : ""}
        className="flex-1 min-w-[8rem] bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
    </div>
  );
}

const containerV = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const itemV = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.32, ease: "easeOut" } } };

/* ─── Main ─── */
export function CompanyProfile() {
  const { user, token, updateUser } = useCompany();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingExt, setLoadingExt] = useState(true);
  const [basic, setBasic] = useState({ name: user.name || "", phone: user.phone || "", sector: user.sector || "" });
  const [ext, setExt] = useState<IExtProfile>(defaultExt);

  useEffect(() => {
    if (!token) return;
    fetch("/api/profile/company/extended", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => setExt({ ...defaultExt, ...data }))
      .catch(() => {})
      .finally(() => setLoadingExt(false));
  }, [token]);

  if (!user.id) {
    return (
      <div className="w-full grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="md:col-span-4 space-y-4">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
        <div className="md:col-span-8 space-y-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-48 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    try {
      const [bRes, eRes] = await Promise.all([
        fetch("/api/profile/company", { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(basic) }),
        fetch("/api/profile/company/extended", { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(ext) }),
      ]);
      if (!bRes.ok || !eRes.ok) throw new Error();
      const bd = await bRes.json();
      updateUser({ name: bd.name, phone: bd.phone, sector: bd.sector });
      toast.success("Profile saved!");
      setEditing(false);
    } catch { toast.error("Failed to save profile."); }
    finally { setSaving(false); }
  };

  return (
    <motion.div variants={containerV} initial="hidden" animate="show" className="w-full pb-16">

      {/* ── Header ── */}
      <motion.div variants={itemV} className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <FiBriefcase className="h-4 w-4 text-primary" />
          </div>
          <h1 className="text-xl font-bold">Company Profile</h1>
        </div>
        <AnimatePresence mode="wait">
          {!editing ? (
            <motion.div key="edit" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
              <Button size="sm" onClick={() => { setBasic({ name: user.name || "", phone: user.phone || "", sector: user.sector || "" }); setEditing(true); }} className="gap-1.5 text-xs">
                <FiEdit2 className="h-3.5 w-3.5" />Edit Profile
              </Button>
            </motion.div>
          ) : (
            <motion.div key="save" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditing(false)} disabled={saving} className="gap-1.5 text-xs">
                <FiX className="h-3.5 w-3.5" />Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5 text-xs">
                <FiSave className="h-3.5 w-3.5" />{saving ? "Saving…" : "Save"}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── 2-Column Layout ── */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">

        {/* ── Left: Identity ── */}
        <div className="md:col-span-4 flex flex-col gap-6 md:sticky md:top-6">

          {/* Identity Card */}
          <motion.div variants={itemV}>
            <Card className="rounded-2xl border shadow-sm overflow-hidden">
            <CardContent className="pt-6 pb-6 px-6">
              <div className="mb-4">
                  <AvatarUpload
                    currentUrl={user.logoUrl}
                    fallbackInitial={(user.name?.[0] ?? "C").toUpperCase()}
                    role="company"
                    token={token}
                    onUploaded={url => updateUser({ logoUrl: url })}
                    size={80}
                  />
                </div>
                <h2 className="text-xl font-bold leading-tight">{user.name || "—"}</h2>
                <p className="text-xs text-muted-foreground mt-1">{user.email}</p>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  <Badge className="text-xs bg-primary/10 text-primary border-primary/20 font-semibold">Company</Badge>
                  {user.sector && <Badge variant="outline" className="text-xs font-medium">{user.sector}</Badge>}
                </div>

                {/* 2×2 Stats — Employees + Est. Year */}
                <div className="grid grid-cols-2 gap-3 mt-5">
                  {[
                    { label: "Employees", value: loadingExt ? "—" : String(ext.employeeCount || 1), icon: FiUsers },
                    { label: "Est. Year", value: loadingExt ? "—" : String(ext.yearEstablished || "—"), icon: FiBriefcase },
                  ].map(s => (
                    <div key={s.label} className="rounded-xl border bg-muted/40 p-3 flex flex-col gap-1">
                      <s.icon className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="text-lg font-bold leading-none">{s.value}</p>
                      <p className="text-[10px] text-muted-foreground font-medium">{s.label}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* About */}
          <motion.div variants={itemV}>
            <CardSection icon={FiStar} title="About" description="Company mission & bio" accent="amber">
              {editing
                ? <textarea value={ext.bio} onChange={e => setExt(p => ({ ...p, bio: e.target.value }))} placeholder="Describe your company, mission, and what makes you the right choice…" rows={5} maxLength={2000} className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm leading-relaxed placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-300 transition-shadow resize-none" />
                : <p className="text-sm text-muted-foreground leading-relaxed">{ext.bio || <span className="italic text-muted-foreground/60">No bio yet.</span>}</p>}
            </CardSection>
          </motion.div>

        </div>

        {/* ── Right: Detail Cards ── */}
        <div className="md:col-span-8 flex flex-col gap-6">

          {loadingExt ? (
            [...Array(4)].map((_, i) => <Skeleton key={i} className="h-48 rounded-2xl" />)
          ) : (
            <>
              {/* Company Info */}
              <motion.div variants={itemV}>
                <CardSection icon={FiBriefcase} title="Company Info" description="Basic company details" accent="violet">
                  {editing ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Company Name</Label>
                        <Input value={basic.name} onChange={e => setBasic(p => ({ ...p, name: e.target.value }))} placeholder="Company name" className="h-9 text-sm" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Phone</Label>
                        <Input value={basic.phone} onChange={e => setBasic(p => ({ ...p, phone: e.target.value }))} placeholder="+1 234 567 8900" className="h-9 text-sm" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Sector / Industry</Label>
                        <Input value={basic.sector} onChange={e => setBasic(p => ({ ...p, sector: e.target.value }))} placeholder="e.g. Construction" className="h-9 text-sm" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Year Established</Label>
                        <Input type="number" min={1900} max={new Date().getFullYear()} value={ext.yearEstablished} onChange={e => setExt(p => ({ ...p, yearEstablished: Number(e.target.value) }))} className="h-9 text-sm" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Employee Count</Label>
                        <Input type="number" min={1} value={ext.employeeCount} onChange={e => setExt(p => ({ ...p, employeeCount: Number(e.target.value) }))} className="h-9 text-sm" />
                      </div>
                      <div className="sm:col-span-2 rounded-lg bg-muted/50 border px-3 py-2.5">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Email (read-only)</p>
                        <p className="text-sm font-medium mt-1">{user.email || "—"}</p>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <ProfileField icon={FiBriefcase} label="Company Name" value={user.name} />
                      <ProfileField icon={FiPhone} label="Phone" value={user.phone} />
                      <ProfileField icon={FiMail} label="Email" value={user.email} />
                      <ProfileField icon={FiUsers} label="Sector" value={user.sector} />
                      <ProfileField icon={FiBriefcase} label="Year Established" value={String(ext.yearEstablished || "—")} />
                      <ProfileField icon={FiUsers} label="Employees" value={String(ext.employeeCount || 1)} />
                    </div>
                  )}
                </CardSection>
              </motion.div>

              {/* Address */}
              <motion.div variants={itemV}>
                <CardSection icon={FiMapPin} title="Address" description="Office & registered address" accent="emerald">
                  {editing ? (
                    <LocationPicker
                      value={{
                        displayName: ext.address.displayName,
                        lat: ext.address.lat ?? undefined,
                        lng: ext.address.lng ?? undefined,
                        city: ext.address.city,
                        state: ext.address.state,
                        country: ext.address.country,
                        zipCode: ext.address.zipCode,
                        street: ext.address.street,
                      }}
                      onChange={(loc: LocationValue) =>
                        setExt(p => ({
                          ...p,
                          address: {
                            street: loc.street ?? "",
                            city: loc.city ?? "",
                            state: loc.state ?? "",
                            zipCode: loc.zipCode ?? "",
                            country: loc.country ?? "",
                            lat: loc.lat ?? null,
                            lng: loc.lng ?? null,
                            displayName: loc.displayName ?? "",
                          },
                        }))
                      }
                    />
                  ) : (
                    <div>
                      {ext.address.displayName ? (
                        <ProfileField icon={FiMapPin} label="Location" value={ext.address.displayName} />
                      ) : (
                        <>
                          {ext.address.street && <ProfileField icon={FiMapPin} label="Street" value={ext.address.street} />}
                          {(ext.address.city || ext.address.state) && (
                            <ProfileField icon={FiMapPin} label="City / State" value={[ext.address.city, ext.address.state].filter(Boolean).join(", ")} />
                          )}
                          {ext.address.zipCode && <ProfileField icon={FiMapPin} label="ZIP Code" value={ext.address.zipCode} />}
                          {ext.address.country && <ProfileField icon={FiMapPin} label="Country" value={ext.address.country} />}
                        </>
                      )}
                    </div>
                  )}
                </CardSection>
              </motion.div>

              {/* Languages */}
              <motion.div variants={itemV}>
                <CardSection icon={FiUsers} title="Languages" description="Languages your company operates in" accent="indigo">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Languages</Label>
                    {editing ? <TagInput id="co-lang" tags={ext.languages} onChange={v => setExt(p => ({ ...p, languages: v }))} placeholder="e.g. English, Hindi…" /> : <TagList tags={ext.languages} />}
                  </div>
                </CardSection>
              </motion.div>

              {/* Legal & Social */}
              <motion.div variants={itemV}>
                <CardSection icon={FiFileText} title="Legal & Social" description="Registration details and online presence" accent="blue">
                  {editing ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Website</Label>
                        <Input value={ext.website} onChange={e => setExt(p => ({ ...p, website: e.target.value }))} placeholder="https://yourcompany.com" className="h-9 text-sm" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">GST Number</Label>
                        <Input value={ext.gstNumber} onChange={e => setExt(p => ({ ...p, gstNumber: e.target.value }))} placeholder="GST #" className="h-9 text-sm" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">PAN Number</Label>
                        <Input value={ext.panNumber} onChange={e => setExt(p => ({ ...p, panNumber: e.target.value }))} placeholder="PAN #" className="h-9 text-sm" />
                      </div>
                      {(["linkedin", "facebook", "instagram", "twitter"] as const).map(k => (
                        <div key={k} className="space-y-1.5">
                          <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{k.charAt(0).toUpperCase() + k.slice(1)}</Label>
                          <Input value={ext.socialLinks[k]} onChange={e => setExt(p => ({ ...p, socialLinks: { ...p.socialLinks, [k]: e.target.value } }))} placeholder={`https://${k}.com/…`} className="h-9 text-sm" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div>
                      <ProfileField icon={FiGlobe} label="Website" value={ext.website} />
                      <ProfileField icon={FiShield} label="GST Number" value={ext.gstNumber} />
                      <ProfileField icon={FiFileText} label="PAN Number" value={ext.panNumber} />
                      <ProfileField icon={FiGlobe} label="LinkedIn" value={ext.socialLinks.linkedin} />
                      <ProfileField icon={FiGlobe} label="Facebook" value={ext.socialLinks.facebook} />
                      <ProfileField icon={FiGlobe} label="Instagram" value={ext.socialLinks.instagram} />
                      <ProfileField icon={FiGlobe} label="Twitter" value={ext.socialLinks.twitter} />
                    </div>
                  )}
                </CardSection>
              </motion.div>

              {/* Info Banner */}
              <motion.div variants={itemV} className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-xl p-4 flex gap-4 items-start">
                <div className="mt-0.5 min-w-[20px] text-amber-600">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
                </div>
                <div className="space-y-1">
                  <h4 className="font-semibold text-sm text-amber-900 dark:text-amber-100">Profile Visibility</h4>
                  <p className="text-xs text-amber-800 dark:text-amber-200/80 leading-relaxed">
                    A complete profile improves your visibility to contractors and workers. Click &quot;Edit Profile&quot; above to update your information.
                  </p>
                </div>
              </motion.div>
            </>
          )}

        </div>
      </div>
    </motion.div>
  );
}