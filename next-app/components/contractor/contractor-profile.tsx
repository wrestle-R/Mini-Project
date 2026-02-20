"use client";

import { useState, useEffect, KeyboardEvent } from "react";
import { motion } from "framer-motion";
import { useContractor } from "@/contexts/ContractorContext";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { AvatarUpload } from "@/components/shared/avatar-upload";
import { toast } from "sonner";
import {
  FiUser, FiBriefcase, FiMapPin, FiGlobe, FiFileText,
  FiTool, FiDollarSign, FiStar, FiAward,
  FiEdit2, FiSave, FiX, FiShield, FiPhone,
} from "react-icons/fi";

/* ─── Types ─── */
type ProjectSize = "small" | "medium" | "large" | "any";
interface IExtProfile {
  bio: string;
  industry: string;
  companySize: number;
  yearEstablished: number;
  licenseNumber: string;
  taxId: string;
  serviceAreas: string[];
  projectTypes: string[];
  preferredProjectSize: ProjectSize;
  minProjectValue: number;
  maxProjectValue: number;
  socialLinks: { website: string; linkedin: string; facebook: string; instagram: string };
  languages: string[];
  averageRating?: number;
  totalProjectsCompleted?: number;
  isVerified?: boolean;
}

const defaultExt: IExtProfile = {
  bio: "", industry: "General Construction", companySize: 1,
  yearEstablished: new Date().getFullYear(), licenseNumber: "", taxId: "",
  serviceAreas: [], projectTypes: [],
  preferredProjectSize: "any", minProjectValue: 0, maxProjectValue: 0,
  socialLinks: { website: "", linkedin: "", facebook: "", instagram: "" },
  languages: [],
};

const projectSizeOpts: ProjectSize[] = ["small", "medium", "large", "any"];
const projectTypeOpts = ["Residential", "Commercial", "Industrial", "Infrastructure", "Interior", "Renovation"];

/* ─── Shared sub-components ─── */
function SectionHeader({ icon: Icon, title, accent = "indigo" }: { icon: React.ElementType; title: string; accent?: string }) {
  const colors: Record<string, string> = {
    indigo: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400",
    violet: "bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400",
    emerald: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
    amber:  "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
    blue:   "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
    rose:   "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400",
  };
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${colors[accent] ?? colors.indigo}`}>
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div>
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
        <div className="h-0.5 w-8 rounded-full bg-primary/40 mt-0.5" />
      </div>
    </div>
  );
}

function Field({ label, children, editing, colSpan }: { label: string; children: React.ReactNode; editing?: boolean; colSpan?: string }) {
  return (
    <div className={`space-y-1.5 ${colSpan ?? ""}`}>
      <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.1em]">{label}</Label>
      {editing !== undefined && !editing
        ? <p className="text-sm font-semibold min-h-[1.75rem] text-foreground">{children as React.ReactNode}</p>
        : children}
    </div>
  );
}

function TagList({ tags }: { tags: string[] }) {
  if (!tags || tags.length === 0) return <p className="text-sm text-muted-foreground italic">—</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map(t => <Badge key={t} variant="secondary" className="text-xs px-2.5 py-0.5 rounded-full font-medium">{t}</Badge>)}
    </div>
  );
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
export function ContractorProfile() {
  const { user, token, updateUser } = useContractor();
  const { firstName, lastName, email, phone, photoUrl, id } = user;

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingExt, setLoadingExt] = useState(true);
  const [basic, setBasic] = useState({ firstName: firstName || "", lastName: lastName || "", phone: phone || "" });
  const [ext, setExt] = useState<IExtProfile>(defaultExt);

  useEffect(() => {
    if (!token) return;
    fetch("/api/profile/contractor/extended", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => setExt({ ...defaultExt, ...data }))
      .catch(() => {})
      .finally(() => setLoadingExt(false));
  }, [token]);

  if (!id) {
    return <div className="w-full space-y-4"><Skeleton className="h-64 w-full rounded-2xl" /><Skeleton className="h-24 w-full rounded-2xl" /></div>;
  }

  const displayName = [firstName, lastName].filter(Boolean).join(" ") || "—";

  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    try {
      const [bRes, eRes] = await Promise.all([
        fetch("/api/profile/contractor", { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(basic) }),
        fetch("/api/profile/contractor/extended", { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(ext) }),
      ]);
      if (!bRes.ok || !eRes.ok) throw new Error();
      const bd = await bRes.json();
      updateUser({ firstName: bd.firstName, lastName: bd.lastName, phone: bd.phone });
      toast.success("Profile saved!");
      setEditing(false);
    } catch { toast.error("Failed to save profile."); }
    finally { setSaving(false); }
  };

  const statCards = [
    { label: "Projects Done", value: ext.totalProjectsCompleted ?? 0, icon: FiAward, color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-50 dark:bg-violet-900/20 border-violet-100 dark:border-violet-800" },
    { label: "Avg Rating",    value: ext.averageRating?.toFixed(1) ?? "—", icon: FiStar, color: "text-amber-600 dark:text-amber-400",  bg: "bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800" },
    { label: "Est. Year",     value: ext.yearEstablished || "—",    icon: FiBriefcase, color: "text-blue-600 dark:text-blue-400",   bg: "bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800" },
    { label: "Team Size",     value: ext.companySize || 1,           icon: FiUser, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800" },
  ];

  return (
    <motion.div variants={containerV} initial="hidden" animate="show" className="w-full space-y-8 pb-16">

      {/* ── Hero Banner ── */}
      <motion.div variants={itemV}>
        <Card className="overflow-hidden border-0 shadow-lg rounded-2xl">
          <div className="relative h-40 sm:h-48 bg-gradient-to-r from-primary/10 to-primary/5 overflow-hidden">
            <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, var(--primary) 0%, transparent 50%)' }} />
            
            {/* Action buttons */}
            <div className="absolute top-4 right-4 flex gap-2">
              {!editing
                ? <Button size="sm" onClick={() => { setBasic({ firstName: firstName || "", lastName: lastName || "", phone: phone || "" }); setEditing(true); }} className="gap-1.5 bg-primary text-white hover:bg-primary/90 border-0 shadow-md text-xs font-semibold">
                    <FiEdit2 className="h-3.5 w-3.5" />Edit
                  </Button>
                : <>
                    <Button size="sm" variant="outline" onClick={() => setEditing(false)} disabled={saving} className="gap-1.5 text-xs">
                      <FiX className="h-3.5 w-3.5" />Cancel
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5 bg-primary text-white hover:bg-primary/90 border-0 shadow-md font-semibold text-xs">
                      <FiSave className="h-3.5 w-3.5" />{saving ? "Saving…" : "Save"}
                    </Button>
                  </>}
            </div>
          </div>
          
          <CardContent className="px-6 sm:px-8 pt-0 pb-8">
            <div className="flex flex-col sm:flex-row sm:items-end gap-6 -mt-12 sm:-mt-16">
              {/* Avatar */}
              <div className="ring-4 ring-background rounded-2xl shadow-lg shrink-0">
                <AvatarUpload 
                  currentUrl={photoUrl} 
                  fallbackInitial={(firstName?.[0] ?? "?").toUpperCase()} 
                  role="contractor" 
                  token={token} 
                  onUploaded={url => updateUser({ photoUrl: url })} 
                  size={100} 
                />
              </div>
              
              {/* Info Section */}
              <div className="sm:pb-2 min-w-0 flex-1">
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight">{displayName}</h1>
                <p className="text-sm text-muted-foreground mt-2 font-medium">{email}</p>
                
                <div className="flex flex-wrap items-center gap-2 mt-4">
                  <Badge className="text-xs bg-primary text-white border-0 font-semibold">Contractor</Badge>
                  {ext.isVerified && <Badge className="text-xs bg-accent text-accent-foreground border-0 font-semibold"><FiShield className="h-3.5 w-3.5 mr-1" />Verified</Badge>}
                  {ext.averageRating != null && ext.averageRating > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full border">★ {ext.averageRating.toFixed(1)}</span>
                  )}
                  {phone && <Badge variant="outline" className="text-xs px-2.5 py-0.5 font-medium"><FiPhone className="h-3.5 w-3.5 mr-1" />{phone}</Badge>}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Stats Grid ── */}
      <motion.div variants={itemV} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(s => (
          <motion.div key={s.label} whileHover={{ y: -4 }}>
            <Card className={`border-2 shadow-lg rounded-2xl overflow-hidden hover:shadow-xl transition-all ${s.bg}`}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="h-12 w-12 rounded-xl bg-white/80 dark:bg-white/10 flex items-center justify-center shadow-md">
                    <s.icon className={`h-6 w-6 ${s.color}`} />
                  </div>
                </div>
                <p className="text-3xl font-black leading-none mb-2 text-foreground">{loadingExt ? "—" : String(s.value)}</p>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{s.label}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* ── Main Content Grid ── */}
      {loadingExt ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 auto-rows-max">

          {/* ── Left Column ── */}
          <div className="space-y-6 lg:col-span-1">

            {/* Account Info */}
            <motion.div variants={itemV}>
              <Card className="shadow-lg rounded-2xl border-2 overflow-hidden hover:shadow-xl transition-all">
                <CardHeader className="pb-0 pt-6 px-6 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 border-b-2">
                  <SectionHeader icon={FiUser} title="Account Info" accent="blue" />
                </CardHeader>
                <CardContent className="px-6 pb-6 pt-6 space-y-5">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="First Name" editing={editing}>{editing ? <Input value={basic.firstName} onChange={e => setBasic(p => ({ ...p, firstName: e.target.value }))} placeholder="First name" className="h-10 text-sm rounded-lg border-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900" /> : <span className="font-semibold text-foreground">{firstName || "—"}</span>}</Field>
                    <Field label="Last Name" editing={editing}>{editing ? <Input value={basic.lastName} onChange={e => setBasic(p => ({ ...p, lastName: e.target.value }))} placeholder="Last name" className="h-10 text-sm rounded-lg border-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900" /> : <span className="font-semibold text-foreground">{lastName || "—"}</span>}</Field>
                  </div>
                  <Field label="Phone" editing={editing}>{editing ? <Input value={basic.phone} onChange={e => setBasic(p => ({ ...p, phone: e.target.value }))} placeholder="+1 234 567 8900" className="h-10 text-sm rounded-lg border-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900" /> : <span className="font-semibold text-foreground">{phone || "—"}</span>}</Field>
                  <div className="rounded-xl bg-gradient-to-r from-blue-100 to-cyan-100 dark:from-blue-900/20 dark:to-cyan-900/20 px-4 py-3.5">
                    <p className="text-[11px] font-bold text-blue-900 dark:text-blue-300 uppercase tracking-wider">Email</p>
                    <p className="text-sm font-bold text-foreground mt-2">{email || "—"}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">Cannot be changed</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* About / Bio */}
            <motion.div variants={itemV}>
              <Card className="shadow-lg rounded-2xl border-2 overflow-hidden hover:shadow-xl transition-all">
                <CardHeader className="pb-0 pt-6 px-6 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-b-2">
                  <SectionHeader icon={FiStar} title="About" accent="amber" />
                </CardHeader>
                <CardContent className="px-6 pb-6 pt-6">
                  {editing
                    ? <textarea value={ext.bio} onChange={e => setExt(p => ({ ...p, bio: e.target.value }))} placeholder="Describe your company, expertise, and what sets you apart…" rows={5} maxLength={2000} className="w-full rounded-xl border-2 bg-background px-4 py-3 text-sm leading-relaxed placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-300 transition-shadow resize-none focus:border-amber-500" />
                    : <p className="text-sm text-muted-foreground leading-relaxed">{ext.bio || <span className="italic text-muted-foreground/60">No bio yet. Click Edit to add one.</span>}</p>}
                </CardContent>
              </Card>
            </motion.div>

            {/* Project Value Range */}
            <motion.div variants={itemV}>
              <Card className="shadow-lg rounded-2xl border-2 overflow-hidden hover:shadow-xl transition-all">
                <CardHeader className="pb-0 pt-6 px-6 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border-b-2">
                  <SectionHeader icon={FiDollarSign} title="Project Budget" accent="emerald" />
                </CardHeader>
                <CardContent className="px-6 pb-6 pt-6 space-y-4">
                  <Field label="Min Value ($)" editing={editing}>{editing ? <Input type="number" min={0} value={ext.minProjectValue} onChange={e => setExt(p => ({ ...p, minProjectValue: Number(e.target.value) }))} className="h-10 text-sm rounded-lg border-2 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200" /> : <span className="font-bold text-lg text-emerald-600">${ext.minProjectValue ? ext.minProjectValue.toLocaleString() : "—"}</span>}</Field>
                  <Field label="Max Value ($)" editing={editing}>{editing ? <Input type="number" min={0} value={ext.maxProjectValue} onChange={e => setExt(p => ({ ...p, maxProjectValue: Number(e.target.value) }))} className="h-10 text-sm rounded-lg border-2 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200" /> : <span className="font-bold text-lg text-emerald-600">${ext.maxProjectValue ? ext.maxProjectValue.toLocaleString() : "—"}</span>}</Field>
                </CardContent>
              </Card>
            </motion.div>

          </div>

          {/* ── Middle Columns ── */}
          <div className="space-y-6 lg:col-span-2 md:col-span-1">

            {/* Business Details */}
            <motion.div variants={itemV}>
              <Card className="shadow-lg rounded-2xl border-2 overflow-hidden hover:shadow-xl transition-all">
                <CardHeader className="pb-0 pt-6 px-6 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 border-b-2">
                  <SectionHeader icon={FiBriefcase} title="Business Details" accent="indigo" />
                </CardHeader>
                <CardContent className="px-6 pb-6 pt-6 space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <Field label="Industry" editing={editing}>{editing ? <Input value={ext.industry} onChange={e => setExt(p => ({ ...p, industry: e.target.value }))} placeholder="General Construction" className="h-10 text-sm rounded-lg border-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200" /> : <span className="font-semibold">{ext.industry || "—"}</span>}</Field>
                    <Field label="Company Size" editing={editing}>{editing ? <Input type="number" min={1} value={ext.companySize} onChange={e => setExt(p => ({ ...p, companySize: Number(e.target.value) }))} className="h-10 text-sm rounded-lg border-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200" /> : <span className="font-semibold">{ext.companySize || 1}<span className="text-xs text-muted-foreground ml-1">emps</span></span>}</Field>
                    <Field label="Year Est." editing={editing}>{editing ? <Input type="number" min={1900} max={new Date().getFullYear()} value={ext.yearEstablished} onChange={e => setExt(p => ({ ...p, yearEstablished: Number(e.target.value) }))} className="h-10 text-sm rounded-lg border-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200" /> : <span className="font-semibold">{String(ext.yearEstablished || "—")}</span>}</Field>
                    <Field label="License #" editing={editing}>{editing ? <Input value={ext.licenseNumber} onChange={e => setExt(p => ({ ...p, licenseNumber: e.target.value }))} placeholder="License #" className="h-10 text-sm rounded-lg border-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200" /> : <span className="font-semibold">{ext.licenseNumber || "—"}</span>}</Field>
                    <Field label="Tax ID" editing={editing} colSpan="sm:col-span-2">{editing ? <Input value={ext.taxId} onChange={e => setExt(p => ({ ...p, taxId: e.target.value }))} placeholder="Tax / VAT ID" className="h-10 text-sm rounded-lg border-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200" /> : <span className="font-semibold">{ext.taxId || "—"}</span>}</Field>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Services */}
            <motion.div variants={itemV}>
              <Card className="shadow-lg rounded-2xl border-2 overflow-hidden hover:shadow-xl transition-all">
                <CardHeader className="pb-0 pt-6 px-6 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 border-b-2">
                  <SectionHeader icon={FiTool} title="Services" accent="violet" />
                </CardHeader>
                <CardContent className="px-6 pb-6 pt-6 space-y-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Service Areas</Label>
                      {editing ? <TagInput id="svc-areas" tags={ext.serviceAreas} onChange={v => setExt(p => ({ ...p, serviceAreas: v }))} placeholder="e.g. New York, LA…" /> : <TagList tags={ext.serviceAreas} />}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Languages</Label>
                      {editing ? <TagInput id="c-lang" tags={ext.languages} onChange={v => setExt(p => ({ ...p, languages: v }))} placeholder="e.g. English, Hindi…" /> : <TagList tags={ext.languages} />}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Project Types</Label>
                    {editing
                      ? <div className="flex flex-wrap gap-2">{projectTypeOpts.map(type => {
                          const sel = ext.projectTypes.includes(type);
                          return <button key={type} type="button" onClick={() => setExt(p => ({ ...p, projectTypes: sel ? p.projectTypes.filter(t => t !== type) : [...p.projectTypes, type] }))} className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all border-2 ${sel ? "bg-indigo-100 border-indigo-400 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400" : "bg-background border-border text-muted-foreground hover:bg-muted"}`}>{type}</button>;
                        })}</div>
                      : <TagList tags={ext.projectTypes} />}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Preferred Size</Label>
                    {editing
                      ? <div className="flex flex-wrap gap-2">{projectSizeOpts.map(opt => (
                          <button key={opt} type="button" onClick={() => setExt(p => ({ ...p, preferredProjectSize: opt }))} className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all border-2 capitalize ${ext.preferredProjectSize === opt ? "bg-indigo-100 border-indigo-400 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400" : "bg-background border-border text-muted-foreground hover:bg-muted"}`}>{opt}</button>
                        ))}</div>
                      : <Badge variant="outline" className="capitalize text-xs px-3 py-1.5 font-bold">{ext.preferredProjectSize || "any"}</Badge>}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

          </div>

          {/* ── Right Column ── */}
          <div className="space-y-6 lg:col-span-1">

            {/* Location */}
            <motion.div variants={itemV}>
              <Card className="shadow-lg rounded-2xl border-2 overflow-hidden hover:shadow-xl transition-all">
                <CardHeader className="pb-0 pt-6 px-6 bg-gradient-to-r from-rose-50 to-pink-50 dark:from-rose-950/30 dark:to-pink-950/30 border-b-2">
                  <SectionHeader icon={FiMapPin} title="Service Areas" accent="rose" />
                </CardHeader>
                <CardContent className="px-6 pb-6 pt-6">
                  <div className="space-y-3">
                    {ext.serviceAreas && ext.serviceAreas.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {ext.serviceAreas.map(area => (
                          <Badge key={area} className="text-xs bg-rose-100 text-rose-700 border-rose-300 font-medium">{area}</Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">No areas yet</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Social & Web */}
            <motion.div variants={itemV}>
              <Card className="shadow-lg rounded-2xl border-2 overflow-hidden hover:shadow-xl transition-all">
                <CardHeader className="pb-0 pt-6 px-6 bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-950/30 dark:to-blue-950/30 border-b-2">
                  <SectionHeader icon={FiGlobe} title="Social & Web" accent="cyan" />
                </CardHeader>
                <CardContent className="px-6 pb-6 pt-6 space-y-4">
                  {(["website", "linkedin", "facebook", "instagram"] as const).map(k => (
                    <Field key={k} label={k.charAt(0).toUpperCase() + k.slice(1)} editing={editing}>
                      {editing
                        ? <Input value={ext.socialLinks[k]} onChange={e => setExt(p => ({ ...p, socialLinks: { ...p.socialLinks, [k]: e.target.value } }))} placeholder={`https://${k}.com/…`} className="h-10 text-sm rounded-lg border-2 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200" />
                        : ext.socialLinks[k]
                          ? <a href={ext.socialLinks[k]} target="_blank" rel="noopener noreferrer" className="text-sm text-cyan-600 hover:underline truncate block font-medium">{ext.socialLinks[k]}</a>
                          : <span className="text-muted-foreground">—</span>}
                    </Field>
                  ))}
                </CardContent>
              </Card>
            </motion.div>

          </div>
        </div>
      )}
    </motion.div>
  );
}





