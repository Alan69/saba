import { Plan } from '@prisma/client';

export interface PlanLimits {
  boxes: number;
  masters: number;
  waPerMonth: number;
  features: {
    waNotifications: boolean;
    waCampaigns: boolean;
    fullAnalytics: boolean;
    nps: boolean;
    salary: boolean;
    masterCabinet: boolean;
    rfm: boolean;
    hidePoweredBy: boolean;
  };
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  light: {
    boxes: 4,
    masters: 5,
    waPerMonth: 0,
    features: {
      waNotifications: false,
      waCampaigns: false,
      fullAnalytics: false,
      nps: false,
      salary: false,
      masterCabinet: false,
      rfm: false,
      hidePoweredBy: false,
    },
  },
  business: {
    boxes: 8,
    masters: 15,
    waPerMonth: 10_000,
    features: {
      waNotifications: true,
      waCampaigns: true,
      fullAnalytics: true,
      nps: true,
      salary: true,
      masterCabinet: true,
      rfm: true,
      hidePoweredBy: true,
    },
  },
};
