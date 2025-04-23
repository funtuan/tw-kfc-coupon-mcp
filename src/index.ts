#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import axios from "axios";
import { Coupon } from "./types.js";

class CouponServer {
  private server: McpServer;
  private coupons: Coupon[] = [];

  constructor() {
    this.server = new McpServer({
      name: "kfc-coupon-server",
      version: "1.0.0",
    });
    this.loadCouponsFromApi()
    this.registerTools();
  }

  private async loadCouponsFromApi(): Promise<void> {
    // 下載優惠券資料
    // 由 https://raw.githubusercontent.com/Winedays/KCouper/refs/heads/master/js/coupon.js 下載
    // const COUPON_DICT={"coupon_by_code": {"24499": {"name": "24499-宜睿智慧分享", "product_code": "TA4923", "coupon_code":....
    // 移除開頭 const COUPON_DICT=
    // 轉換為 JSON 格式
    const url = "https://raw.githubusercontent.com/Winedays/KCouper/refs/heads/master/js/coupon.js";
    const response = await axios.get(url);
    const data = response.data;
    const jsonString = data.replace(/const COUPON_DICT=/, "").trim();
    const jsonData = JSON.parse(jsonString);
    // 轉換為 Coupon[] 格式
    const coupons: Coupon[] = Object.entries(jsonData.coupon_by_code).map(([key, value]) => ({
      id: key,
      ...(typeof value === "object" && value !== null ? value : {}),
    })) as Coupon[];

    this.coupons = coupons;
  }

  private registerTools() {

    const filterItem = {
      '蛋撻': ['原味蛋撻', '蛋撻'],
      '炸雞': ['咔啦脆雞', '卡啦脆雞'],
      '椒麻雞': ['青花椒香麻脆雞'],
      '紙包雞': ['義式香草紙包雞', '紙包雞'],
      '咔啦雞堡': ['咔啦雞腿堡', '卡啦雞腿堡'],
      '花生熔岩雞腿堡': ['花生熔岩卡啦雞腿堡', '花生熔岩咔啦雞腿堡'],
      '椒麻雞腿堡': ['青花椒香麻咔啦雞腿堡', '青花椒香麻卡啦雞腿堡', '青花椒咔啦雞腿堡'],
      '煙燻雞堡': ['美式煙燻咔脆雞堡', '美式煙燻卡脆雞堡'],
      '烤雞腿堡': ['紐奧良烙烤雞腿堡', '紐奧良烤腿堡'],
      '莎莎雞腿捲': ['墨西哥莎莎雞腿捲'],
      '雞柳捲': ['花生起司雞柳捲'],
      '燻雞捲': ['原味起司燻雞捲'],
      '雞塊': ['上校雞塊'],
      '脆薯': ['香酥脆薯', '20:00後供應香酥脆薯', '小薯', '薯條'],
      'QQ球': ['雙色轉轉QQ球'],
      '經典玉米': ['經典玉米'],
      '點心盒': ['點心盒-上校雞塊+香酥脆薯', '點心盒'],
      '雞汁飯': ['20:00前供應雞汁風味飯', '雞汁風味飯'],
      '大福': ['草苺起司冰淇淋大福'],
      '沙拉': ['鮮蔬沙拉'],
    };
    const keywords = Object.keys(filterItem);

    // 工具 2：根據條件搜尋優惠券
    this.server.tool(
      "searchCoupons",
      "查詢肯德基優惠券",
      {
        keywords: z.array(z.enum(keywords as [string, ...string[]])).optional(),
        minPrice: z.number().optional(),
        maxPrice: z.number().optional(),
      }, async (input) => {

        // 擴展關鍵字，由 filterItem
        const keywords = [
          ...(input.keywords || []),
          ...(input.keywords ? input.keywords.map(keyword => filterItem[keyword as keyof typeof filterItem] || []).flat() : []),
        ]

        const filteredCoupons = this.coupons.filter(coupon => {
          const items = coupon.items || [];
          // 檢查關鍵字
          const matchesKeywords = keywords.length
            ? keywords.some(keyword =>
              items.some(item => {
                const itemName = item.name.toLowerCase();
                return (
                  itemName.includes(keyword.toLowerCase())
                );
              })
            )
            : true;
          // 檢查價格範圍
          const matchesMinPrice = input.minPrice
            ? coupon.price >= input.minPrice
            : true;
          const matchesMaxPrice = input.maxPrice
            ? coupon.price <= input.maxPrice
            : true;
          return matchesKeywords && matchesMinPrice && matchesMaxPrice;
        });

        return {
          content: [
            {
              "type": "text",
              "text": JSON.stringify({
                message: `Found ${filteredCoupons.length} coupons`,
                coupons: filteredCoupons
              })
            }
          ],
        };
      },
    )
  }

  async start() {
    // 使用標準輸入輸出作為傳輸層
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log("Taiwan KFC coupon server started");
  }
}

const server = new CouponServer();
server.start().catch(console.error);