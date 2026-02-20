"use client";

import { useState, useEffect, KeyboardEvent } from "react";
import { motion } from "framer-motion";
import { useWorker } from "@/contexts/WorkerContext";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { AvatarUpload } from "@/components/shared/avatar-upload";
import { toast } from "sonner";
import {
  FiUser, FiBriefcase, FiMapPin, FiTool, FiAward, FiStar,
  FiPlus, FiTrash2, FiEdit2, FiSave, FiX, FiAlertTriangle, FiPhone,
} from "react-icons/fi";

/* ─── Types ─── */
type AvailStatus = "available" | "busy" | "offline";
interface ICertification { name: string; issuingBody: string; year: number; }
interface IExtProfile {
  bio: string; skills: string[]; tradeSpecialties: string[];
  experienceYears: number; hourlyRate: number;
  availability: { status: AvailStatus };
  location: { city: string; state: string; country: string; zipCode: string };
  languages: string[]; certifications: ICertification[];
  emergencyContact: { name: string; phone: string; relationship: string };
  preferredWorkTypes: string[]; toolsOwned: string[];
  hasVehicle: boolean; willingToRelocate: boolean;
}
const defaultExt: IExtProfile = {
  bio: "", skills: [], tradeSpecialties: [], experienceYears: 0, hourlyRate: 0,
  availability: { status: "available" },
  location: { city: "", state: "", country: "", zipCode: "" },
  languages: [], certifications: [],
  emergencyContact: { name: "", phone: "", relationship: "" },
  preferredWorkTypes: [], toolsOwned: [], hasVehicle: false, willingToRelocate: false,
};

const availPalette: Record<AvailStatus, string> = {
  available: "bg-emerald-100 border-emerald-400 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  busy: "bg-amber-100 border-amber-400 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  offline: "bg-muted border-border text-muted-foreground",
};
const availDot: Record<AvailStatus, string> = {
  available: "text-emerald-500", busy: "text-amber-500", offline: "text-muted-foreground",
};
const workTypeOpts = ["Full-time", "Part-time", "Contract", "Daily Labor", "Weekend", "Remote"];

/* ─── Sub-components ─── */

function SectionHeader({ icon: Icon, title, accent = "blue" }: { icon: React.ElementType; title: string; accent?: string }) {
  const colors: Record<string, string> = {
    blue:    "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
    indigo:  "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400",
    emerald: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
    amber:   "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
    violet:  "bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400",
    rose:    "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400",
    cyan:    "bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400",
  };
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${colors[accent] ?? colors.blue}`}>
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div>
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
        <div className="h-0.5 w-8 rounded-full bg-primary/40 mt-0.5" />
      </div>
    </div>
  );
}

function Field({ label, children, editing }: { label: string; children: React.ReactNode; editing?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.1em]">{label}</Label>
      {editing !== undefined && !editing
        ? <p className="text-sm font-semibold min-h-[1.75rem] text-foreground">{children as React.ReactNode}</p>
        : children}
    </div>
  );
}

function TagList({ tags, variant = "secondary" }: { tags: string[]; variant?: "secondary" | "outline" | "default" }) {
  if (!tags || tags.length === 0) return <p className="text-sm text-muted-foreground italic">—</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map(t => <Badge key={t} variant={variant} className="text-xs px-2.5 py-0.5 rounded-full font-medium">{t}</Badge>)}
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
      <input
        id={id}
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={onKey}
        onBlur={() => input && add(input)}
        placeholder={tags.length === 0 ? (placeholder ?? "Type and press Enter") : ""}
        className="flex-1 min-w-[8rem] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}

function ToggleRow({ label, desc, checked, editing, onChange }: {
  label: string; desc: string; checked: boolean; editing: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border px-4 py-3.5 bg-muted/20">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
      {editing
        ? <Switch checked={checked} onCheckedChange={onChange} />
        : <Badge variant={checked ? "default" : "outline"} className="text-xs">{checked ? "Yes" : "No"}</Badge>}
    </div>
  );
}

const containerV = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const itemV = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.32, ease: "easeOut" } } };

/* ─── Main ─── */
export function WorkerProfile() {
  const { user, updateUser, firebaseUser } = useWorker();
  const { firstName, lastName, email, phone, photoUrl, firebaseUid } = user;

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingExt, setLoadingExt] = useState(true);
  const [firebaseToken, setFirebaseToken] = useState<string | null>(null);
  const [basic, setBasic] = useState({ firstName: firstName || "", lastName: lastName || "", phone: phone || "" });
  const [ext, setExt] = useState<IExtProfile>(defaultExt);
  const [newCert, setNewCert] = useState<ICertification>({ name: "", issuingBody: "", year: new Date().getFullYear() });

  useEffect(() => {
    if (!firebaseUser) return;
    firebaseUser.getIdToken().then(token => {
      setFirebaseToken(token);
      fetch("/api/profile/extended", { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(data => setExt({ ...defaultExt, ...data }))
        .catch(() => {})
        .finally(() => setLoadingExt(false));
    });
  }, [firebaseUser]);

  if (!firebaseUid) {
    return <div className="w-full space-y-4"><Skeleton className="h-64 w-full rounded-2xl" /><Skeleton className="h-24 w-full rounded-2xl" /></div>;
  }

  const displayName = [firstName, lastName].filter(Boolean).join(" ") || "—";
  const availStatus: AvailStatus = ext.availability?.status ?? "available";

  const handleSave = async () => {
    if (!firebaseUser) return;
    setSaving(true);
    try {
      const token = await firebaseUser.getIdToken();
      const [bRes, eRes] = await Promise.all([
        fetch("/api/profile", { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(basic) }),
        fetch("/api/profile/extended", { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(ext) }),
      ]);
      if (!bRes.ok || !eRes.ok) throw new Error();
      const bd = await bRes.json();
      updateUser({ firstName: bd.firstName, lastName: bd.lastName, phone: bd.phone });
      toast.success("Profile saved!");
      setEditing(false);
    } catch { toast.error("Failed to save profile."); }
    finally { setSaving(false); }
  };

  const addCert = () => {
    if (!newCert.name.trim()) return;
    setExt(p => ({ ...p, certifications: [...p.certifications, { ...newCert }] }));
    setNewCert({ name: "", issuingBody: "", year: new Date().getFullYear() });
  };

  const statCards = [
    { label: "Experience",  value: `${ext.experienceYears || 0} yrs`, icon: FiBriefcase, color: "text-blue-600 dark:text-blue-400",    bg: "bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800" },
    { label: "Hourly Rate", value: ext.hourlyRate ? `$${ext.hourlyRate}` : "—", icon: FiStar, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800" },
    { label: "Skills",      value: ext.skills?.length ?? 0,           icon: FiTool, color: "text-violet-600 dark:text-violet-400",  bg: "bg-violet-50 dark:bg-violet-900/20 border-violet-100 dark:border-violet-800" },
    { label: "Certs",       value: ext.certifications?.length ?? 0,   icon: FiAward, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800" },
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
                  role="worker" 
                  token={firebaseToken} 
                  onUploaded={url => updateUser({ photoUrl: url })} 
                  size={100} 
                />
              </div>
              
              {/* Info Section */}
              <div className="sm:pb-2 min-w-0 flex-1">
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight">{displayName}</h1>
                <p className="text-sm text-muted-foreground mt-2 font-medium">{email}</p>
                
                <div className="flex flex-wrap items-center gap-2 mt-4">
                  <Badge className="text-xs bg-primary text-white border-0 font-semibold">Worker</Badge>
                  {!loadingExt && (
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${availPalette[availStatus]}`}>
                      <span className="h-2 w-2 rounded-full inline-block" style={{
                        backgroundColor: availStatus === 'available' ? '#10b981' : availStatus === 'busy' ? '#f59e0b' : '#6b7280'
                      }} />
                      {availStatus}
                    </span>
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
                  {loadingExt ? <Skeleton className="h-6 w-12" /> : null}
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
          <div className="space-y-6 lg:col-span-1 md:col-span-1">

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
                    ? <textarea value={ext.bio} onChange={e => setExt(p => ({ ...p, bio: e.target.value }))} placeholder="Write a short bio about yourself, your experience, and what makes you stand out…" rows={5} maxLength={1000} className="w-full rounded-xl border-2 bg-background px-4 py-3 text-sm leading-relaxed placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-300 transition-shadow resize-none focus:border-amber-500" />
                    : <p className="text-sm text-muted-foreground leading-relaxed">{ext.bio || <span className="italic text-muted-foreground/60">No bio yet. Click Edit to add one.</span>}</p>}
                </CardContent>
              </Card>
            </motion.div>

          </div>

          {/* ── Middle Columns ── */}
          <div className="space-y-6 lg:col-span-2 md:col-span-1">

            {/* Professional Details */}
            <motion.div variants={itemV}>
              <Card className="shadow-lg rounded-2xl border-2 overflow-hidden hover:shadow-xl transition-all">
                <CardHeader className="pb-0 pt-6 px-6 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 border-b-2">
                  <SectionHeader icon={FiBriefcase} title="Professional Details" accent="indigo" />
                </CardHeader>
                <CardContent className="px-6 pb-6 pt-6 space-y-5">
                  <div className="grid grid-cols-3 gap-4 sm:grid-cols-3">
                    <Field label="Experience (yrs)" editing={editing}>{editing ? <Input type="number" min={0} value={ext.experienceYears} onChange={e => setExt(p => ({ ...p, experienceYears: Number(e.target.value) }))} className="h-10 text-sm rounded-lg border-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900" /> : <span className="font-bold text-lg text-indigo-600">{ext.experienceYears || 0}<span className="text-xs text-muted-foreground ml-1">yrs</span></span>}</Field>
                    <Field label="Hourly Rate ($)" editing={editing}>{editing ? <Input type="number" min={0} value={ext.hourlyRate} onChange={e => setExt(p => ({ ...p, hourlyRate: Number(e.target.value) }))} className="h-10 text-sm rounded-lg border-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900" /> : <span className="font-bold text-lg text-green-600">${ext.hourlyRate || "—"}</span>}</Field>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Status</Label>
                      {editing
                        ? <div className="flex flex-col gap-1">{(["available", "busy", "offline"] as AvailStatus[]).map(opt => (
                            <button key={opt} type="button" onClick={() => setExt(p => ({ ...p, availability: { ...p.availability, status: opt } }))} className={`px-2 py-1 rounded-lg text-xs font-bold transition-all border-2 capitalize ${availStatus === opt ? availPalette[opt] : "bg-background border-border text-muted-foreground hover:bg-muted"}`}>{opt}</button>
                          ))}</div>
                        : <span className={`text-xs font-bold ${availDot[availStatus]}`}>● {availStatus}</span>}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Skills</Label>
                      {editing ? <TagInput id="skills-i" tags={ext.skills} onChange={v => setExt(p => ({ ...p, skills: v }))} placeholder="e.g. Welding, Painting…" /> : <TagList tags={ext.skills} />}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Trade Specialties</Label>
                      {editing ? <TagInput id="spec-i" tags={ext.tradeSpecialties} onChange={v => setExt(p => ({ ...p, tradeSpecialties: v }))} placeholder="e.g. Carpentry…" /> : <TagList tags={ext.tradeSpecialties} variant="outline" />}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Preferences */}
            <motion.div variants={itemV}>
              <Card className="shadow-lg rounded-2xl border-2 overflow-hidden hover:shadow-xl transition-all">
                <CardHeader className="pb-0 pt-6 px-6 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 border-b-2">
                  <SectionHeader icon={FiTool} title="Work Preferences" accent="violet" />
                </CardHeader>
                <CardContent className="px-6 pb-6 pt-6 space-y-5">
                  <div className="space-y-3">
                    <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Preferred Work Types</Label>
                    {editing
                      ? <div className="flex flex-wrap gap-2">{workTypeOpts.map(type => {
                          const sel = ext.preferredWorkTypes.includes(type);
                          return <button key={type} type="button" onClick={() => setExt(p => ({ ...p, preferredWorkTypes: sel ? p.preferredWorkTypes.filter(t => t !== type) : [...p.preferredWorkTypes, type] }))} className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all border-2 ${sel ? "bg-violet-100 border-violet-400 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400" : "bg-background border-border text-muted-foreground hover:bg-muted"}`}>{type}</button>;
                        })}</div>
                      : <TagList tags={ext.preferredWorkTypes} />}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Tools Owned</Label>
                    {editing ? <TagInput id="tools-i" tags={ext.toolsOwned} onChange={v => setExt(p => ({ ...p, toolsOwned: v }))} placeholder="e.g. Drill, Level…" /> : <TagList tags={ext.toolsOwned} />}
                  </div>
                  <div className="grid gap-3 grid-cols-2">
                    <ToggleRow label="Has Vehicle" desc="Own transportation" checked={ext.hasVehicle} editing={editing} onChange={v => setExt(p => ({ ...p, hasVehicle: v }))} />
                    <ToggleRow label="Relocate" desc="Open to moving" checked={ext.willingToRelocate} editing={editing} onChange={v => setExt(p => ({ ...p, willingToRelocate: v }))} />
                  </div>
                </CardContent>
              </Card>
            </motion.div>

          </div>

          {/* ── Right Columns ── */}
          <div className="space-y-6 lg:col-span-1">

            {/* Location & Languages */}
            <motion.div variants={itemV}>
              <Card className="shadow-lg rounded-2xl border-2 overflow-hidden hover:shadow-xl transition-all">
                <CardHeader className="pb-0 pt-6 px-6 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border-b-2">
                  <SectionHeader icon={FiMapPin} title="Location" accent="emerald" />
                </CardHeader>
                <CardContent className="px-6 pb-6 pt-6 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    {(["city", "state"] as const).map(k => (
                      <Field key={k} label={k.charAt(0).toUpperCase() + k.slice(1)} editing={editing}>
                        {editing ? <Input value={ext.location[k]} onChange={e => setExt(p => ({ ...p, location: { ...p.location, [k]: e.target.value } }))} placeholder={k} className="h-10 text-sm rounded-lg border-2 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200" /> : <span className="font-semibold">{ext.location[k] || "—"}</span>}
                      </Field>
                    ))}
                    {(["zipCode", "country"] as const).map(k => (
                      <Field key={k} label={k === "zipCode" ? "Zip" : "Country"} editing={editing}>
                        {editing ? <Input value={ext.location[k]} onChange={e => setExt(p => ({ ...p, location: { ...p.location, [k]: e.target.value } }))} placeholder={k} className="h-10 text-sm rounded-lg border-2 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200" /> : <span className="font-semibold">{ext.location[k] || "—"}</span>}
                      </Field>
                    ))}
                  </div>
                  <div className="space-y-2 pt-2">
                    <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Languages</Label>
                    {editing ? <TagInput id="lang-i" tags={ext.languages} onChange={v => setExt(p => ({ ...p, languages: v }))} placeholder="e.g. English…" /> : <TagList tags={ext.languages} />}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Emergency Contact */}
            <motion.div variants={itemV}>
              <Card className="shadow-lg rounded-2xl border-2 overflow-hidden hover:shadow-xl transition-all">
                <CardHeader className="pb-0 pt-6 px-6 bg-gradient-to-r from-rose-50 to-pink-50 dark:from-rose-950/30 dark:to-pink-950/30 border-b-2">
                  <SectionHeader icon={FiAlertTriangle} title="Emergency Contact" accent="rose" />
                </CardHeader>
                <CardContent className="px-6 pb-6 pt-6 space-y-4">
                  {(["name", "phone", "relationship"] as const).map(k => (
                    <Field key={k} label={k.charAt(0).toUpperCase() + k.slice(1)} editing={editing}>
                      {editing ? <Input value={ext.emergencyContact[k]} onChange={e => setExt(p => ({ ...p, emergencyContact: { ...p.emergencyContact, [k]: e.target.value } }))} placeholder={k} className="h-10 text-sm rounded-lg border-2 focus:border-rose-500 focus:ring-2 focus:ring-rose-200" /> : <span className="font-semibold">{ext.emergencyContact[k] || "—"}</span>}
                    </Field>
                  ))}
                </CardContent>
              </Card>
            </motion.div>

            {/* Certifications */}
            <motion.div variants={itemV}>
              <Card className="shadow-lg rounded-2xl border-2 overflow-hidden hover:shadow-xl transition-all">
                <CardHeader className="pb-0 pt-6 px-6 bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-950/30 dark:to-blue-950/30 border-b-2">
                  <SectionHeader icon={FiAward} title="Certifications" accent="cyan" />
                </CardHeader>
                <CardContent className="px-6 pb-6 pt-6 space-y-3">
                  {ext.certifications.length === 0 && !editing && <p className="text-sm text-muted-foreground italic">No certs yet</p>}
                  <div className="space-y-2">
                    {ext.certifications.map((c, i) => (
                      <div key={i} className="flex items-center justify-between rounded-lg border-2 px-3 py-2.5 bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-900/10 dark:to-blue-900/10">
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate">{c.name}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{c.year}</p>
                        </div>
                        {editing && <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/10 shrink-0" onClick={() => setExt(p => ({ ...p, certifications: p.certifications.filter((_, ci) => ci !== i) }))}><FiTrash2 className="h-3 w-3" /></Button>}
                      </div>
                    ))}
                  </div>
                  {editing && (
                    <div className="rounded-lg border-2 border-dashed p-3.5 space-y-3 bg-muted/5 mt-3">
                      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Add Cert</p>
                      <div className="grid gap-2 grid-cols-1">
                        <Input value={newCert.name} onChange={e => setNewCert(p => ({ ...p, name: e.target.value }))} placeholder="Name" className="h-9 text-xs rounded-lg border-2" />
                        <Input value={newCert.issuingBody} onChange={e => setNewCert(p => ({ ...p, issuingBody: e.target.value }))} placeholder="Issuer" className="h-9 text-xs rounded-lg border-2" />
                        <Input type="number" value={newCert.year} onChange={e => setNewCert(p => ({ ...p, year: Number(e.target.value) }))} placeholder={`${new Date().getFullYear()}`} className="h-9 text-xs rounded-lg border-2" />
                      </div>
                      <Button size="sm" variant="outline" onClick={addCert} className="gap-1.5 text-xs w-full border-2"><FiPlus className="h-3.5 w-3.5" />Add</Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

          </div>
        </div>
      )}
    </motion.div>
  );
}


