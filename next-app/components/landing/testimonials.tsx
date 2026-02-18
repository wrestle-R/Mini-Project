"use client";

import { motion } from "framer-motion";
import { Testimonials as TestimonialCards } from "@/components/ui/twitter-testimonial-cards";

const cards = [
  {
    avatar: "https://api.dicebear.com/9.x/adventurer/svg?seed=Arav",
    username: "Arav Patel",
    handle: "@arav_patel",
    content:
      "BuildSync completely changed how we track daily progress on site. Reports that used to take an hour now take 5 minutes. Incredible tool!",
    date: "May 28, 2025",
    likes: 234,
    retweets: 41,
    verified: true,
  },
  {
    avatar: "https://api.dicebear.com/9.x/adventurer/svg?seed=Sanya",
    username: "Sanya Mehta",
    handle: "@sanya_builds",
    content:
      "As a contractor managing 3 projects, BuildSync's dashboard gives me a single view of attendance, tasks, and materials. Absolute game-changer.",
    date: "Jun 2, 2025",
    likes: 189,
    retweets: 33,
    verified: true,
  },
  {
    avatar: "https://api.dicebear.com/9.x/adventurer/svg?seed=Ravi",
    username: "Ravi Kumar",
    handle: "@ravikumar_eng",
    content:
      "The invoicing feature alone saved our firm ₹2 lakhs last quarter in billing errors. The material tracking is the cherry on top.",
    date: "Jun 10, 2025",
    likes: 312,
    retweets: 67,
    verified: true,
  },
];

export function TestimonialsSection() {
  return (
    <section className="w-full py-20 px-6" id="testimonials">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6 }}
        className="mx-auto max-w-3xl text-center"
      >
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-foreground">
          Loved by builders
        </h2>
        <p className="mt-3 mb-14 text-muted-foreground">
          See what construction professionals are saying.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="mx-auto max-w-lg"
      >
        <TestimonialCards cards={cards} />
      </motion.div>
    </section>
  );
}
