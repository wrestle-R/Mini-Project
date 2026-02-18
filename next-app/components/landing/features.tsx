"use client";

import { motion } from "framer-motion";
import { BentoGridShowcase } from "@/components/ui/bento-product-features";
import {
  FiClipboard,
  FiUsers,
  FiPackage,
  FiBarChart2,
  FiCheckSquare,
  FiZap,
} from "react-icons/fi";

function FeatureCell({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="flex h-full flex-col items-start justify-end gap-2 p-4">
      <div className="rounded-lg bg-primary/10 p-2">
        <Icon className="h-6 w-6 text-primary" />
      </div>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {description}
      </p>
    </div>
  );
}

export function Features() {
  return (
    <section className="w-full py-20 px-6" id="features">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6 }}
        className="mx-auto max-w-5xl"
      >
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-foreground">
            Everything you need on site
          </h2>
          <p className="mt-3 text-muted-foreground">
            A complete suite of tools designed for construction teams.
          </p>
        </div>

        <BentoGridShowcase
          integration={
            <FeatureCell
              icon={FiClipboard}
              title="Daily Progress Reports"
              description="Capture daily logs, photos, and notes from the field in real-time."
            />
          }
          trackers={
            <FeatureCell
              icon={FiUsers}
              title="Attendance Tracking"
              description="Mark worker attendance and track working hours effortlessly."
            />
          }
          statistic={
            <FeatureCell
              icon={FiBarChart2}
              title="Analytics Dashboard"
              description="Visualise project progress with real-time charts and KPIs."
            />
          }
          focus={
            <FeatureCell
              icon={FiCheckSquare}
              title="Task Management"
              description="Assign, prioritise, and track tasks across your teams."
            />
          }
          productivity={
            <FeatureCell
              icon={FiPackage}
              title="Material Logistics"
              description="Monitor materials inventory, orders, and deliveries."
            />
          }
          shortcuts={
            <FeatureCell
              icon={FiZap}
              title="Invoicing & Billing"
              description="Generate invoices, track payments, and manage billing cycles all in one place."
            />
          }
        />
      </motion.div>
    </section>
  );
}
