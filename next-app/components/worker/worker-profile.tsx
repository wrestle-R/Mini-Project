"use client";

import { useState, useEffect, KeyboardEvent } from "react";
import { motion } from "framer-motion";
import { useWorker } from "@/contexts/WorkerContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { AvatarUpload } from "@/components/shared/avatar-upload";
import { LocationPicker, LocationValue } from "@/components/shared/location-picker";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  FiUser, FiBriefcase, FiMapPin, FiTool, FiStar,
  FiEdit2, FiSave, FiX, FiAlertTriangle, FiPhone,
  FiMail, FiShield,
} from "react-icons/fi";

/* ─── Types ─── */
type AvailStatus = "available" | "busy" | "offline";
interface ILocation {
  city: string; state: string; country: string; zipCode: string;
  lat: number | null; lng: number | null; displayName: string; street: string;
}
interface IExtProfile {
  bio: string; skills: string[]; tradeSpecialties: string[];
  experienceYears: number; hourlyRate: number;
  availability: { status: AvailStatus };
  location: ILocation;
  languages: string[];
  emergencyContact: { name: string; phone: string; relationship: string };
  preferredWorkTypes: string[]; toolsOwned: string[];
  hasVehicle: boolean; willingToRelocate: boolean;
}

const defaultExt: IExtProfile = {
  bio: "", skills: [], tradeSpecialties: [], experienceYears: 0, hourlyRate: 0,
  availability: { status: "available" },
  location: { city: "", state: "", country: "", zipCode: "", lat: null, lng: null, displayName: "", street: "" },
  languages: [], emergencyContact: { name: "", phone: "", relationship: "" },
  preferredWorkTypes: [], toolsOwned: [], hasVehicle: false, willingToRelocate: false,
};

const availPalette: Record<AvailStatus, string> = {
  available: "bg-emerald-100 border-emerald-400 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  busy: "bg-amber-100 border-amber-400 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  offline: "bg-muted border-border text-muted-foreground",
};
const workTypeOpts = ["Full-time", "Part-time", "Contract", "Daily Labor", "Weekend", "Remote"];

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
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg ${accent}`}><Icon className="w-4 h-4" /></div>
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
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
      <input
        id={id} value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKey}
        onBlur={() => input && add(input)}
        placeholder={tags.length === 0 ? (placeholder ?? "Type and press Enter") : ""}
        className="flex-1 min-w-[8rem] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
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
  const [embeddingStatus, setEmbeddingStatus] = useState<null | {
    exists: boolean;
    updatedAt?: string;
    dim?: number;
    model?: string;
  }>(null);
  const [embeddingLoading, setEmbeddingLoading] = useState(false);

  useEffect(() => {
    if (!firebaseUser) return;
    firebaseUser.getIdToken().then(token => {
      setFirebaseToken(token);
      fetch("/api/profile/extended", { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(data => setExt({ ...defaultExt, ...data }))
        .catch(() => {})
        .finally(() => setLoadingExt(false));

      fetch("/api/profile/face-embedding", { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(data => {
          setEmbeddingStatus({
            exists: Boolean(data?.exists),
            updatedAt: data?.embedding?.updatedAt,
            dim: data?.embedding?.dim,
            model: data?.embedding?.model,
          });
        })
        .catch(() => {});
    });
  }, [firebaseUser]);

  const createOrRefreshEmbedding = async () => {
    if (!firebaseUser) return;
    setEmbeddingLoading(true);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch("/api/profile/face-embedding", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to create embedding");
      }

      setEmbeddingStatus({
        exists: true,
        updatedAt: data?.embedding?.updatedAt,
        dim: data?.embedding?.dim,
        model: data?.embedding?.model,
      });
      toast.success("Face embedding created and synced.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create embedding");
    } finally {
      setEmbeddingLoading(false);
    }
  };

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

  if (loadingExt) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="md:col-span-4 space-y-4">
          <Skeleton className="h-72 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
        <div className="md:col-span-8 space-y-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-48 w-full rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const locationLine = [ext.location.city, ext.location.state, ext.location.country].filter(Boolean).join(", ");

  return (
    <motion.div variants={containerV} initial="hidden" animate="show" className="w-full space-y-6 pb-8">

      {/* Header */}
      <motion.div variants={itemV} className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <FiUser className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Worker Profile</h1>
            <p className="text-xs text-muted-foreground">Manage your personal and professional information</p>
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

        {/* ── LEFT COLUMN ── */}
        <motion.div variants={itemV} className="md:col-span-4 flex flex-col gap-6 md:sticky md:top-6">

          {/* Identity Card — no banner/gradient */}
          <Card className="overflow-hidden border shadow-md">
            <CardContent className="pt-6 pb-6 px-6 flex flex-col items-center text-center">
              <div className="relative mb-4">
                <div className="ring-4 ring-background rounded-full shadow-lg overflow-hidden">
                  <AvatarUpload
                    currentUrl={photoUrl}
                    fallbackInitial={(firstName?.[0] ?? "?").toUpperCase()}
                    role="worker"
                    token={firebaseToken}
                    onUploaded={url => updateUser({ photoUrl: url })}
                    size={96}
                  />
                </div>
                <div className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-background" title="Active" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-1">{displayName}</h2>
              <div className="flex flex-wrap items-center justify-center gap-1.5 mb-4">
                <Badge className="text-xs bg-primary text-white border-0 font-semibold">Worker</Badge>
                <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${availPalette[availStatus]}`}>
                  {availStatus}
                </span>
              </div>
              <div className="w-full">
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Experience</p>
                  <p className="font-bold text-foreground">{ext.experienceYears || 0} yrs</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* About Card */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FiStar className="w-3.5 h-3.5 text-muted-foreground" />About
              </CardTitle>
            </CardHeader>
            <CardContent>
              {editing
                ? <textarea value={ext.bio} onChange={e => setExt(p => ({ ...p, bio: e.target.value }))} placeholder="Write a short bio about yourself…" rows={4} maxLength={1000} className="w-full rounded-lg border bg-background px-3 py-2 text-sm leading-relaxed placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
                : <p className="text-sm text-muted-foreground leading-relaxed">{ext.bio || <span className="italic opacity-60">No bio yet. Click Edit to add one.</span>}</p>}
            </CardContent>
          </Card>
        </motion.div>

        {/* ── RIGHT COLUMN ── */}
        <div className="md:col-span-8 flex flex-col gap-6">

          {/* Account Info */}
          <motion.div variants={itemV}>
            <CardSection icon={FiUser} title="Account Information" description="Your basic personal and contact details." accent="bg-blue-500/10 text-blue-600">
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
                    <Input value={basic.phone} onChange={e => setBasic(p => ({ ...p, phone: e.target.value }))} placeholder="+91 98765 43210" className="h-10" />
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

          {/* Professional Details */}
          <motion.div variants={itemV}>
            <CardSection icon={FiBriefcase} title="Professional Details" description="Your experience, skills and availability." accent="bg-purple-500/10 text-purple-600">
              {editing ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">Experience (years)</Label>
                      <Input type="number" min={0} value={ext.experienceYears} onChange={e => setExt(p => ({ ...p, experienceYears: Number(e.target.value) }))} className="h-10" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">Hourly Rate (₹)</Label>
                      <Input type="number" min={0} value={ext.hourlyRate} onChange={e => setExt(p => ({ ...p, hourlyRate: Number(e.target.value) }))} className="h-10" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">Availability</Label>
                      <div className="flex flex-col gap-1">
                        {(["available", "busy", "offline"] as AvailStatus[]).map(opt => (
                          <button key={opt} type="button" onClick={() => setExt(p => ({ ...p, availability: { ...p.availability, status: opt } }))}
                            className={`px-2 py-1 rounded-lg text-xs font-bold transition-all border-2 capitalize ${availStatus === opt ? availPalette[opt] : "bg-background border-border text-muted-foreground hover:bg-muted"}`}>{opt}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">Skills</Label>
                      <TagInput id="skills-i" tags={ext.skills} onChange={v => setExt(p => ({ ...p, skills: v }))} placeholder="e.g. Welding, Painting…" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">Trade Specialties</Label>
                      <TagInput id="spec-i" tags={ext.tradeSpecialties} onChange={v => setExt(p => ({ ...p, tradeSpecialties: v }))} placeholder="e.g. Carpentry…" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <ProfileField icon={FiBriefcase} label="Experience" value={`${ext.experienceYears || 0} years`} />
                    <ProfileField icon={FiBriefcase} label="Hourly Rate" value={ext.hourlyRate ? `₹${ext.hourlyRate}/hr` : undefined} />
                    <ProfileField icon={FiShield} label="Availability" value={availStatus} className="md:col-span-2" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Skills</p>
                    <TagList tags={ext.skills} />
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Trade Specialties</p>
                    <TagList tags={ext.tradeSpecialties} />
                  </div>
                </div>
              )}
            </CardSection>
          </motion.div>

          {/* Work Preferences — compacted */}
          <motion.div variants={itemV}>
            <CardSection icon={FiTool} title="Work Preferences" description="Your preferred work arrangements and tools." accent="bg-amber-500/10 text-amber-600">
              {editing ? (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Preferred Work Types</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {workTypeOpts.map(type => {
                        const sel = ext.preferredWorkTypes.includes(type);
                        return <button key={type} type="button" onClick={() => setExt(p => ({ ...p, preferredWorkTypes: sel ? p.preferredWorkTypes.filter(t => t !== type) : [...p.preferredWorkTypes, type] }))}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border-2 ${sel ? "bg-primary/10 border-primary/40 text-primary" : "bg-background border-border text-muted-foreground hover:bg-muted"}`}>{type}</button>;
                      })}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Tools Owned</Label>
                    <TagInput id="tools-i" tags={ext.toolsOwned} onChange={v => setExt(p => ({ ...p, toolsOwned: v }))} placeholder="e.g. Drill, Level…" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Languages</Label>
                    <TagInput id="lang-i" tags={ext.languages} onChange={v => setExt(p => ({ ...p, languages: v }))} placeholder="e.g. Hindi, English…" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center justify-between rounded-lg border px-3 py-2 bg-muted/20">
                      <div>
                        <p className="text-sm font-medium">Has Vehicle</p>
                        <p className="text-xs text-muted-foreground">Own transport</p>
                      </div>
                      <Switch checked={ext.hasVehicle} onCheckedChange={v => setExt(p => ({ ...p, hasVehicle: v }))} />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border px-3 py-2 bg-muted/20">
                      <div>
                        <p className="text-sm font-medium">Relocate</p>
                        <p className="text-xs text-muted-foreground">Open to move</p>
                      </div>
                      <Switch checked={ext.willingToRelocate} onCheckedChange={v => setExt(p => ({ ...p, willingToRelocate: v }))} />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">Preferred Work Types</p>
                    <TagList tags={ext.preferredWorkTypes} />
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">Tools Owned</p>
                    <TagList tags={ext.toolsOwned} />
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">Languages</p>
                    <TagList tags={ext.languages} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <ProfileField icon={FiTool} label="Has Vehicle" value={ext.hasVehicle ? "Yes" : "No"} />
                    <ProfileField icon={FiMapPin} label="Willing to Relocate" value={ext.willingToRelocate ? "Yes" : "No"} />
                  </div>
                </div>
              )}
            </CardSection>
          </motion.div>

          {/* Location — Nominatim + Map */}
          <motion.div variants={itemV}>
            <CardSection icon={FiMapPin} title="Location" description="Where you are based — search or pick on the map." accent="bg-emerald-500/10 text-emerald-600">
              {editing ? (
                <LocationPicker
                  value={{
                    displayName: ext.location.displayName,
                    lat: ext.location.lat ?? undefined,
                    lng: ext.location.lng ?? undefined,
                    city: ext.location.city,
                    state: ext.location.state,
                    country: ext.location.country,
                    zipCode: ext.location.zipCode,
                    street: ext.location.street,
                  }}
                  onChange={(loc: LocationValue) =>
                    setExt(p => ({
                      ...p,
                      location: {
                        city: loc.city, state: loc.state, country: loc.country,
                        zipCode: loc.zipCode, lat: loc.lat, lng: loc.lng,
                        displayName: loc.displayName, street: loc.street,
                      },
                    }))
                  }
                />
              ) : (
                <div className="space-y-2">
                  {locationLine ? (
                    <div className="flex items-start gap-2 text-sm">
                      <FiMapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                      <span className="text-foreground font-medium">{locationLine}</span>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No location set.</p>
                  )}
                  {ext.location.street && <p className="text-xs text-muted-foreground pl-6">{ext.location.street}</p>}
                  {ext.location.zipCode && <p className="text-xs text-muted-foreground pl-6">PIN: {ext.location.zipCode}</p>}
                </div>
              )}
            </CardSection>
          </motion.div>

          {/* Emergency Contact */}
          <motion.div variants={itemV}>
            <CardSection icon={FiAlertTriangle} title="Emergency Contact" description="Person to contact in case of emergency." accent="bg-rose-500/10 text-rose-600">
              {editing ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(["name", "phone", "relationship"] as const).map(k => (
                    <div key={k} className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground capitalize">{k}</Label>
                      <Input value={ext.emergencyContact[k]} onChange={e => setExt(p => ({ ...p, emergencyContact: { ...p.emergencyContact, [k]: e.target.value } }))} placeholder={k} className="h-10" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <ProfileField icon={FiUser} label="Name" value={ext.emergencyContact.name} />
                  <ProfileField icon={FiPhone} label="Phone" value={ext.emergencyContact.phone} />
                  <ProfileField icon={FiShield} label="Relationship" value={ext.emergencyContact.relationship} />
                </div>
              )}
            </CardSection>
          </motion.div>

          {/* Info Banner */}
          <motion.div variants={itemV}>
            <CardSection icon={FiShield} title="Face Enrollment" description="Use your uploaded photo to create vector embedding for attendance." accent="bg-sky-500/10 text-sky-600">
              <div className="flex flex-col gap-3">
                <div className="rounded-lg border bg-muted/20 p-3 text-sm">
                  <p>
                    Status: {embeddingStatus?.exists ? "Enrolled" : "Not enrolled"}
                    {embeddingStatus?.dim ? ` • ${embeddingStatus.dim}d` : ""}
                    {embeddingStatus?.model ? ` • ${embeddingStatus.model}` : ""}
                  </p>
                  {embeddingStatus?.updatedAt && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Last updated: {new Date(embeddingStatus.updatedAt).toLocaleString("en-IN")}
                    </p>
                  )}
                </div>
                <div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={createOrRefreshEmbedding}
                    disabled={embeddingLoading}
                  >
                    {embeddingLoading ? "Syncing..." : "Create / Refresh Embedding"}
                  </Button>
                </div>
              </div>
            </CardSection>
          </motion.div>

          <motion.div variants={itemV} className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-xl p-4 flex gap-4 items-start">
            <div className="mt-0.5 min-w-[20px] text-amber-600">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
            </div>
            <div className="space-y-1">
              <h4 className="font-semibold text-sm text-amber-900 dark:text-amber-100">Profile Information</h4>
              <p className="text-xs text-amber-800 dark:text-amber-200/80 leading-relaxed">
                Keep your profile up to date to improve your visibility to companies and contractors. Click &ldquo;Edit Profile&rdquo; above to update your information.
              </p>
            </div>
          </motion.div>

        </div>
      </div>
    </motion.div>
  );
}
