window.MAREL_CONFIG = window.MAREL_CONFIG || {};
window.MAREL_CONFIG.pipelines = Object.freeze({
  sales: ["New Lead", "Lead Review", "Qualified", "Consultation Scheduled", "Discovery", "Awaiting Plans / Measurements", "Design in Progress", "Proposal Ready", "Proposal Presented", "Follow-Up", "Negotiation", "Contract Sent", "Won", "On Hold", "Lost"],
  delivery: ["Deposit Received", "Final Measurements", "Technical Review", "Client Approval", "Production Ready", "Production in Brazil", "Freight", "Customs", "Delivery Scheduled", "Installation", "Punch List", "Final Walkthrough", "Completed", "Warranty / Aftercare"],
  partners: ["Identified", "Initial Outreach", "Intro Meeting", "Qualified Partner", "Relationship Development", "Active Referral Partner", "Strategic Partner", "Dormant"]
});
