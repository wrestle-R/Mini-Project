"use client";

import { useState, useEffect, KeyboardEvent } from "react";
import { motion } from "framer-motion";
import { useContractor } from "@/contexts/ContractorContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AvatarUpload } from "@/components/shared/avatar-upload";
import { toast } from "sonner";
import {
  FiUser, FiBriefcase, FiGlobe, FiFileText, FiStar,
  FiEdit2, FiSave, FiX, FiShield, FiPhone, FiMail,
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
  socialLinks: { website: string; linkedin: string; facebook: string; instagram: string };
  languages: string[];
  averageRating?: number;
  totalProjectsCompleted?: number;
  isVerified?: boolean;
}

const defaultExt: IExtProfile = {
  bio: "", industry: "General Construction", companySize: 1,
  yearEstablished: new Date().getFullYear(), licenseNumber: "", taxId: "",
  socialLinks: { website: "", linkedin: "", facebook: "", instagram: "" },
  languages: [],
};

/* ─── Sub-components ─── */

function ProfileField({ icon: Icon, label, value, className }: {
  icon: React.ElementType; label: string; value?: string | null; className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3 p-3 rounded-lg border bg-card/50 hover:bg-card transition-colors", className)}>
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold truncate text-foreground">{value || "—"}</p>
      </div>
    </div>
  );
}

function CardSection({ icon: Icon, title, description, accent, children }: {
  icon: React.ElementType; title: string; description?: string; accent: string; children: React.ReactNode;
}) {
  return (
    <Card className="border shadow-sm">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg ${accent}`}><Icon className="w-5 h-5" /></div>
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
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

  if (loadingExt) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="md:col-span-4 space-y-4">
          <Skeleton className="h-96 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
        <div className="md:col-span-8 space-y-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-48 w-full rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <motion.div variants={containerV} initial="hidden" animate="show" className="w-full space-y-6 pb-8">

      {/* Header */}
      <motion.div variants={itemV} className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <FiUser className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Contractor Profile</h1>
            <p className="text-xs text-muted-foreground">Manage your professional and business information</p>
          </div>
        </div>
        <div className="flex gap-2">
          {!editing
            ? <Button size="sm" onClick={() => { setBasic({ firstName: firstName || "", lastName: lastName || "", phone: phone || "" }); setEditing(true); }} className="gap-1.5 text-xs font-semibold">
                <FiEdit2 className="h-3.5 w-3.5" />Edit Profile
              </Button>
            : <>
                <Button size="sm" variant="outline" onClick={() => setEditing(false)} disabled={saving} className="gap-1.5 text-xs">
                  <FiX className="h-3.5 w-3.5" />Cancel
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5 text-xs font-semibold">
                  <FiSave className="h-3.5 w-3.5" />{saving ? "Saving…" : "Save Changes"}
                </Button>
              </>}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">

        {/* ── LEFT COLUMN – Sticky Identity Card ── */}
        <motion.div variants={itemV} className="md:col-span-4 flex flex-col gap-6 md:sticky md:top-6">

          <Card className="overflow-hidden border shadow-md">
            <CardContent className="pt-6 pb-6 px-6 flex flex-col items-center -mt-0 text-center">
              <div className="relative mb-4">
                <div className="ring-4 ring-background rounded-full shadow-lg overflow-hidden">
                  <AvatarUpload
                    currentUrl={photoUrl}
                    fallbackInitial={(firstName?.[0] ?? "?").toUpperCase()}
                    role="contractor"
                    token={token}
                    onUploaded={url => updateUser({ photoUrl: url })}
                    size={96}
                  />
                </div>
                <div className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-background" title="Active" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-1">{displayName}</h2>
              <div className="flex flex-wrap items-center justify-center gap-1.5 mb-4">
                <Badge className="text-xs bg-primary text-white border-0 font-semibold">Contractor</Badge>
                {ext.isVerified && <Badge className="text-xs bg-emerald-600 text-white border-0 font-semibold"><FiShield className="h-3 w-3 mr-1" />Verified</Badge>}
                {ext.averageRating != null && ext.averageRating > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full border">★ {ext.averageRating.toFixed(1)}</span>
                )}
              </div>
              <div className="w-full">
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Est. Year</p>
                  <p className="font-bold text-foreground">{ext.yearEstablished || "—"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FiStar className="w-3.5 h-3.5 text-muted-foreground" />About
              </CardTitle>
            </CardHeader>
            <CardContent>
              {editing
                ? <textarea value={ext.bio} onChange={e => setExt(p => ({ ...p, bio: e.target.value }))} placeholder="Describe your company, expertise, and what sets you apart…" rows={4} maxLength={2000} className="w-full rounded-lg border bg-background px-3 py-2 text-sm leading-relaxed placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
                : <p className="text-sm text-muted-foreground leading-relaxed">{ext.bio || <span className="italic opacity-60">No bio yet. Click Edit to add one.</span>}</p>}
            </CardContent>
          </Card>
        </motion.div>

        {/* ── RIGHT COLUMN ── */}
        <div className="md:col-span-8 flex flex-col gap-6">

          {/* Account Info */}
          <motion.div variants={itemV}>
            <CardSection icon={FiUser} title="Account Information" description="Your personal and contact details." accent="bg-blue-500/10 text-blue-600">
              {editing ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">First Name</Label>
                    <Input value={basic.firstName} onChange={e => setBasic(p => ({ ...p, firstName: e.target.value }))} placeholder="First name" className="h-10" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Last Name</Label>
                    <Input value={basic.lastName} onChange={e => setBasic(p => ({ ...p, lastName: e.target.value }))} placeholder="Last name" className="h-10" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Phone</Label>
                    <Input value={basic.phone} onChange={e => setBasic(p => ({ ...p, phone: e.target.value }))} placeholder="+1 234 567 8900" className="h-10" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Email</Label>
                    <Input value={email || ""} disabled className="h-10 opacity-60" />
                    <p className="text-xs text-muted-foreground">Cannot be changed</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <ProfileField icon={FiUser} label="First Name" value={firstName} />
                  <ProfileField icon={FiUser} label="Last Name" value={lastName} />
                  <ProfileField icon={FiPhone} label="Phone" value={phone} />
                  <ProfileField icon={FiMail} label="Email" value={email} />
                </div>
              )}
            </CardSection>
          </motion.div>

          {/* Business Details */}
          <motion.div variants={itemV}>
            <CardSection icon={FiBriefcase} title="Business Details" description="Company and professional information." accent="bg-indigo-500/10 text-indigo-600">
              {editing ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Industry</Label>
                    <Input value={ext.industry} onChange={e => setExt(p => ({ ...p, industry: e.target.value }))} placeholder="General Construction" className="h-10" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Company Size</Label>
                    <Input type="number" min={1} value={ext.companySize} onChange={e => setExt(p => ({ ...p, companySize: Number(e.target.value) }))} className="h-10" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Year Established</Label>
                    <Input type="number" min={1900} max={new Date().getFullYear()} value={ext.yearEstablished} onChange={e => setExt(p => ({ ...p, yearEstablished: Number(e.target.value) }))} className="h-10" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">License Number</Label>
                    <Input value={ext.licenseNumber} onChange={e => setExt(p => ({ ...p, licenseNumber: e.target.value }))} placeholder="License #" className="h-10" />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <Label className="text-xs font-medium text-muted-foreground">Tax ID</Label>
                    <Input value={ext.taxId} onChange={e => setExt(p => ({ ...p, taxId: e.target.value }))} placeholder="Tax / VAT ID" className="h-10" />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <ProfileField icon={FiBriefcase} label="Industry" value={ext.industry} />
                  <ProfileField icon={FiUser} label="Company Size" value={ext.companySize ? `${ext.companySize} employees` : undefined} />
                  <ProfileField icon={FiBriefcase} label="Year Established" value={ext.yearEstablished ? String(ext.yearEstablished) : undefined} />
                  <ProfileField icon={FiFileText} label="License Number" value={ext.licenseNumber} />
                  <ProfileField icon={FiFileText} label="Tax ID" value={ext.taxId} className="md:col-span-2" />
                </div>
              )}
            </CardSection>
          </motion.div>

          {/* Languages */}
          <motion.div variants={itemV}>
            <CardSection icon={FiGlobe} title="Languages" description="Languages you communicate in." accent="bg-violet-500/10 text-violet-600">
              {editing ? (
                <TagInput id="c-lang" tags={ext.languages} onChange={v => setExt(p => ({ ...p, languages: v }))} placeholder="e.g. English, Hindi…" />
              ) : (
                <TagList tags={ext.languages} />
              )}
            </CardSection>
          </motion.div>

          {/* Social & Web */}
          <motion.div variants={itemV}>
            <CardSection icon={FiGlobe} title="Social & Web" description="Your online presence and social links." accent="bg-cyan-500/10 text-cyan-600">
              {editing ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(["website", "linkedin", "facebook", "instagram"] as const).map(k => (
                    <div key={k} className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground capitalize">{k}</Label>
                      <Input value={ext.socialLinks[k]} onChange={e => setExt(p => ({ ...p, socialLinks: { ...p.socialLinks, [k]: e.target.value } }))} placeholder={`https://${k}.com/…`} className="h-10" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(["website", "linkedin", "facebook", "instagram"] as const).map(k => (
                    <ProfileField key={k} icon={FiGlobe} label={k.charAt(0).toUpperCase() + k.slice(1)} value={ext.socialLinks[k]} />
                  ))}
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
              <h4 className="font-semibold text-sm text-amber-900 dark:text-amber-100">Profile Information</h4>
              <p className="text-xs text-amber-800 dark:text-amber-200/80 leading-relaxed">
                Keep your profile up to date to improve your visibility to companies and clients. Click &quot;Edit Profile&quot; above to make changes.
              </p>
            </div>
          </motion.div>

        </div>
      </div>
    </motion.div>
  );
}