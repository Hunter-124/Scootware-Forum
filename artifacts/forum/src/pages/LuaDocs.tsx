import React, { useEffect, useRef, useState } from "react";
import { motion, useScroll, useSpring } from "framer-motion";
import { cn } from "@/lib/utils";

export default function LuaDocs() {
  const pulseRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState("");
  const [copyTooltip, setCopyTooltip] = useState<{ id: string; text: string } | null>(null);

  // Background pulse mouse follow
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (pulseRef.current) {
        const x = (e.clientX / window.innerWidth) * 100;
        const y = (e.clientY / window.innerHeight) * 100;
        pulseRef.current.style.setProperty("--mouse-x", `${x}%`);
        pulseRef.current.style.setProperty("--mouse-y", `${y}%`);
      }
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Scroll Spy and Navigation
  useEffect(() => {
    const sections = ["callbacks", "events", "namespaces", "properties", "examples"];
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { threshold: 0.2, rootMargin: "-10% 0px -70% 0px" }
    );

    sections.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const copyToClipboard = async (text: string, id: string, isBlock = false) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyTooltip({ id, text: isBlock ? "Copied Script!" : "Copied!" });
      setTimeout(() => setCopyTooltip(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const navLinks = [
    { id: "callbacks", label: "Callbacks" },
    { id: "events", label: "Game Events" },
    { id: "namespaces", label: "Namespaces" },
    { id: "properties", label: "Entity Properties" },
    { id: "examples", label: "Examples" },
  ];

  return (
    <div className="min-h-screen bg-[#0B0A0F] text-white font-[Poppins] selection:bg-purple-500/30 selection:text-purple-200">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&family=Fira+Code:wght@400;500&display=swap');
        
        :root {
          --primary: #8B5CF6;
          --primary-glow: rgba(139, 92, 246, 0.3);
          --bg-dark: #0B0A0F;
          --glass: rgba(255, 255, 255, 0.03);
          --glass-border: rgba(255, 255, 255, 0.08);
          --text-main: #FFFFFF;
          --text-dim: #9C9C9C;
        }

        .bg-glow {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: radial-gradient(circle at 50% 50%, #1a152e 0%, #0b0a0f 70%);
          z-index: 0;
          pointer-events: none;
        }

        .bg-pulse {
          position: fixed;
          top: -20%;
          left: -20%;
          width: 140%;
          height: 140%;
          background: radial-gradient(circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(139, 92, 246, 0.08) 0%, transparent 40%);
          z-index: 0;
          pointer-events: none;
        }

        .glass-card {
          background: var(--glass);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid var(--glass-border);
          border-radius: 16px;
          transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
        }

        .glass-card:hover {
          border-color: rgba(139, 92, 246, 0.3);
          box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.4);
        }

        .sidebar {
          background: rgba(11, 10, 15, 0.8);
          backdrop-filter: blur(20px);
          border-right: 1px solid var(--glass-border);
        }

        .nav-link {
          position: relative;
          color: var(--text-dim);
          transition: all 0.3s ease;
        }

        .nav-link.active {
          color: var(--primary);
          background: rgba(255, 255, 255, 0.05);
        }

        .nav-link.active::before {
          content: '';
          position: absolute;
          left: 0;
          top: 50%;
          transform: translateY(-50%);
          width: 4px;
          height: 16px;
          background: var(--primary);
          border-radius: 0 4px 4px 0;
          box-shadow: 0 0 10px var(--primary);
        }

        .copy-on-click {
          cursor: pointer;
          position: relative;
          display: inline-block;
          transition: all 0.2s ease;
          font-family: 'Fira Code', monospace;
          background: rgba(139, 92, 246, 0.1);
          padding: 2px 6px;
          border-radius: 4px;
          color: var(--primary);
        }

        .copy-on-click:hover {
          background: rgba(139, 92, 246, 0.2);
          transform: scale(1.05);
        }

        .copy-on-click:active {
          transform: scale(0.95);
        }

        .copy-tooltip {
          position: absolute;
          bottom: 125%;
          left: 50%;
          transform: translateX(-50%) translateY(0);
          background: var(--primary);
          color: white;
          padding: 4px 10px;
          border-radius: 4px;
          font-size: 0.75rem;
          font-family: 'Poppins', sans-serif;
          pointer-events: none;
          z-index: 100;
          white-space: nowrap;
          box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        }

        pre {
          background: #050507 !important;
          border: 1px solid var(--glass-border);
          border-radius: 12px;
          position: relative;
          overflow: hidden;
        }

        .code-header {
          background: rgba(255, 255, 255, 0.03);
          border-bottom: 1px solid var(--glass-border);
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 16px;
        }

        .copy-btn {
          background: var(--primary);
          color: white;
          padding: 4px 12px;
          border-radius: 6px;
          font-size: 0.8rem;
          transition: all 0.3s ease;
        }

        .copy-btn:hover {
          background: #7c3aed;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px var(--primary-glow);
        }

        .kuse-branding {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--text-dim);
          font-size: 0.9rem;
          transition: color 0.3s ease;
          text-decoration: none;
        }

        .kuse-branding:hover {
          color: var(--primary);
        }

        .kuse-logo {
          height: 1.2em;
        }

        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: var(--primary);
        }
      `}</style>

      <div className="bg-glow"></div>
      <div className="bg-pulse" ref={pulseRef}></div>

      {/* Navigation Sidebar */}
      <aside className="sidebar fixed left-0 top-0 h-full w-64 hidden lg:flex flex-col p-6 z-50">
        <div className="mb-10 flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/20">
            <span className="font-bold text-white text-xl">S</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight">SCOOTWARE</h1>
        </div>

        <nav className="space-y-1 flex-grow overflow-y-auto pr-2 custom-scrollbar">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">Documentation</p>
          {navLinks.map((link) => (
            <a
              key={link.id}
              href={`#${link.id}`}
              className={cn(
                "nav-link block py-2 px-3 rounded-lg hover:bg-white/5",
                activeSection === link.id && "active"
              )}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="mt-auto pt-6">
          <a href="https://kuse.ai" target="_blank" rel="noopener noreferrer" className="kuse-branding">
            <span>made with</span>
            <svg className="kuse-logo" viewBox="0 0 160 44" xmlns="http://www.w3.org/2000/svg">
              <path d="m.01,20.65C-.43,8.25,9.3-2.03,22.04.34,34.78,2.72,43.29,8.32,43.29,22.9s-8.66,19.01-22.03,20.3C7.9,44.5.46,33.05.01,20.65z" fill="currentColor" />
              <path fillRule="evenodd" clipRule="evenodd" d="m146.76,7.94c8.07,0,13.24,6.15,13.24,14.58v1.39h-20.75c.45,4.05,3.51,7.37,8.57,7.37,2.62,0,5.73-1.05,7.62-2.94l2.67,3.83c-2.67,2.55-6.62,3.88-10.9,3.88-8.07,0-14.08-5.6-14.08-14.08,0-7.76,5.67-14.02,13.63-14.02zm0,4.77c-5.01,0-7.29,3.83-7.57,7.1h15.13c-.11-3.16-2.28-7.1-7.57-7.1z" fill="currentColor" />
              <path d="m86.64,24.49c0,4.15,2.39,6.84,6.84,6.84,4.4,0,6.84-2.69,6.84-6.84V8.55h5.37v16.33c0,6.7-4.06,11.14-12.21,11.14-8.21,0-12.21-4.5-12.21-11.09V8.55h5.37v15.94zm32.99-16.55c4.49,0,8.06,1.47,10.6,3.86l-2.59,3.81c-2.05-2-5.28-3.08-8.06-3.08-2.88,0-4.84,1.37-4.84,3.32,0,1.91,2.64,2.54,5.81,3.27,4.59,1.08,10.26,2.4,10.26,8.46,0,4.94-3.76,8.41-11.14,8.41-4.98,0-8.94-1.76-11.24-4.11l2.54-4.11c1.86,1.91,5.18,3.67,8.84,3.67,3.91,0,5.57-1.66,5.57-3.62,0-2.3-2.88-2.98-6.21-3.76-4.54-1.08-9.87-2.3-9.87-8.06,0-4.5,4.2-8.06,10.31-8.06zM60.79,20.82,71.44,8.55h6.5L66.46,21.26,78.82,35.44h-6.5l-9.28-11.1-2.25,2.49v8.6h-5.33V8.55h5.33v12.27z" fill="currentColor" />
            </svg>
          </a>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 p-8 max-w-5xl mx-auto relative z-10">
        <motion.header
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <h2 className="text-4xl font-extrabold mb-4 bg-gradient-to-r from-white to-gray-500 bg-clip-text text-transparent">Lua API Documentation</h2>
          <p className="text-gray-400 text-lg">Extend the capabilities of Scootware with powerful Lua scripts. Click any identifier or code block to copy.</p>
        </motion.header>

        {/* Callbacks Section */}
        <motion.section
          id="callbacks"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded bg-purple-500/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold">Callbacks</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="glass-card p-5">
              <div className="relative group/copy inline-block mb-2">
                <span 
                  onClick={() => copyToClipboard("on_paint", "on_paint")}
                  className="copy-on-click text-lg font-semibold block"
                >
                  on_paint
                </span>
                {copyTooltip?.id === "on_paint" && <div className="copy-tooltip show">{copyTooltip.text}</div>}
              </div>
              <p className="text-sm text-gray-400">Called every frame. Essential for rendering UI elements and ESP overlays.</p>
            </div>
            <div className="glass-card p-5">
              <div className="relative group/copy inline-block mb-2">
                <span 
                  onClick={() => copyToClipboard("on_tick", "on_tick")}
                  className="copy-on-click text-lg font-semibold block"
                >
                  on_tick
                </span>
                {copyTooltip?.id === "on_tick" && <div className="copy-tooltip show">{copyTooltip.text}</div>}
              </div>
              <p className="text-sm text-gray-400">Called every game tick. Use for logic that depends on game state synchronization.</p>
            </div>
            <div className="glass-card p-5">
              <div className="relative group/copy inline-block mb-2">
                <span 
                  onClick={() => copyToClipboard("on_unload", "on_unload")}
                  className="copy-on-click text-lg font-semibold block"
                >
                  on_unload
                </span>
                {copyTooltip?.id === "on_unload" && <div className="copy-tooltip show">{copyTooltip.text}</div>}
              </div>
              <p className="text-sm text-gray-400">Called when the script is disabled. Clean up any persisting UI or state here.</p>
            </div>
            <div className="glass-card p-5">
              <div className="relative group/copy inline-block mb-2">
                <span 
                  onClick={() => copyToClipboard("callbacks.register", "callbacks.register")}
                  className="copy-on-click text-lg font-semibold block"
                >
                  callbacks.register
                </span>
                {copyTooltip?.id === "callbacks.register" && <div className="copy-tooltip show">{copyTooltip.text}</div>}
              </div>
              <p className="text-sm text-gray-400">Function used to bind your Lua functions to internal cheat callbacks.</p>
            </div>
          </div>
        </motion.section>

        {/* Events Section */}
        <motion.section
          id="events"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded bg-purple-500/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold">Game Events</h3>
          </div>
          <div className="overflow-hidden glass-card">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/5 bg-white/2">
                  <th className="p-4 font-semibold text-gray-300">Event Name</th>
                  <th className="p-4 font-semibold text-gray-300">Description</th>
                  <th className="p-4 font-semibold text-gray-300">Arguments</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {[
                  { name: "on_hit", desc: "Fires when you damage an enemy.", args: "None" },
                  { name: "player_hurt", desc: "Fires when any player takes damage.", args: "{ name, health, damage }", italic: true },
                  { name: "player_death", desc: "Fires when a player dies.", args: "{ name }", italic: true },
                ].map((event) => (
                  <tr key={event.name}>
                    <td className="p-4">
                      <div className="relative group/copy inline-block">
                        <code 
                          onClick={() => copyToClipboard(event.name, event.name)}
                          className="copy-on-click"
                        >
                          {event.name}
                        </code>
                        {copyTooltip?.id === event.name && <div className="copy-tooltip show">{copyTooltip.text}</div>}
                      </div>
                    </td>
                    <td className="p-4 text-gray-400">{event.desc}</td>
                    <td className={cn("p-4 text-xs text-gray-500", event.italic && "italic")}>{event.args}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.section>

        {/* Namespaces Section */}
        <motion.section
          id="namespaces"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded bg-purple-500/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold">API Functions</h3>
          </div>
          
          <div className="space-y-4">
            {[
              {
                title: "entity_list",
                items: ["entity_list.get_local()", "entity_list.get_players()", "entity_list.get_items()", "entity_list.get_projectiles()"]
              },
              {
                title: "render",
                items: ["render.get_screen_size()", "render.text(x, y, text, r, g, b, a)", "render.line(x0, y0, x1, y1, r, g, b, a, thick)", "render.rect_filled(x, y, w, h, r, g, b, a)"]
              },
              {
                title: "client & ui",
                items: ["client.log(text)", "client.fps()", "ui.checkbox(label, default)", "ui.slider_int(label, min, max, default)"]
              }
            ].map((ns) => (
              <div key={ns.title} className="glass-card p-6">
                <h4 className="text-lg font-semibold mb-4 text-purple-300">{ns.title}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {ns.items.map((item) => (
                    <div key={item} className="relative group/copy inline-block">
                      <code 
                        onClick={() => copyToClipboard(item, item)}
                        className="copy-on-click w-full"
                      >
                        {item}
                      </code>
                      {copyTooltip?.id === item && <div className="copy-tooltip show">{copyTooltip.text}</div>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Properties Section */}
        <motion.section
          id="properties"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <h3 className="text-2xl font-bold mb-6">Entity Properties</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { title: "Player", items: ["name", "health", "alive", "enemy", "money", "weapon_name"] },
              { title: "Projectile", items: ["type", "origin", "velocity", "expire_time"] },
              { title: "Item", items: ["name", "origin", "ammo"] }
            ].map((group) => (
              <div key={group.title} className="glass-card p-4">
                <p className="text-xs text-purple-400 font-bold mb-3 uppercase tracking-wider">{group.title}</p>
                <ul className="space-y-2 text-sm text-gray-300">
                  {group.items.map((item) => (
                    <li key={item}>
                      <div className="relative group/copy inline-block">
                        <code 
                          onClick={() => copyToClipboard(item, `${group.title}-${item}`)}
                          className="copy-on-click"
                        >
                          {item}
                        </code>
                        {copyTooltip?.id === `${group.title}-${item}` && <div className="copy-tooltip show">{copyTooltip.text}</div>}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Examples Section */}
        <motion.section
          id="examples"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-24"
        >
          <h3 className="text-2xl font-bold mb-8">Example Scripts</h3>
          
          <div className="mb-10">
            <div className="code-header">
              <span className="text-sm font-medium text-gray-400">entity_awareness.lua</span>
              <button 
                onClick={() => copyToClipboard(`callbacks.register("on_paint", function()
    -- 1. Check for dangerous projectiles
    local projs = entity_list.get_projectiles()
    for _, p in ipairs(projs) do
        local sx, sy = math2.world_to_screen(p.origin.x, p.origin.y, p.origin.z)
        if sx then
            render.text(sx, sy, "![ " .. p.type .. " ]!", 255, 50, 50, 255)
        end
    end
    -- 2. Detail enemies
    local players = entity_list.get_players()
    for _, ent in ipairs(players) do
        if ent.enemy and ent.alive then
            local x, y, z = ent:get_origin()
            local sx, sy = math2.world_to_screen(x, y, z)
            if sx then
                local info = string.format("%s | HP: %d | %s", ent.name, ent.health, ent.weapon_name)
                render.text(sx, sy, info, 255, 255, 255, 255)
                if ent.scoped then render.text(sx, sy + 15, "SCOPED", 255, 100, 100, 255) end
            end
        end
    end
end)`, "code-block-1", true)}
                className={cn("copy-btn", copyTooltip?.id === "code-block-1" && "bg-emerald-500 hover:bg-emerald-600")}
              >
                {copyTooltip?.id === "code-block-1" ? copyTooltip.text : "Copy Script"}
              </button>
            </div>
            <pre>
              <code className="language-lua p-4 block text-sm text-gray-300 leading-relaxed">
{`callbacks.register("on_paint", function()
    -- 1. Check for dangerous projectiles
    local projs = entity_list.get_projectiles()
    for _, p in ipairs(projs) do
        local sx, sy = math2.world_to_screen(p.origin.x, p.origin.y, p.origin.z)
        if sx then
            render.text(sx, sy, "![ " .. p.type .. " ]!", 255, 50, 50, 255)
        end
    end
    -- 2. Detail enemies
    local players = entity_list.get_players()
    for _, ent in ipairs(players) do
        if ent.enemy and ent.alive then
            local x, y, z = ent:get_origin()
            local sx, sy = math2.world_to_screen(x, y, z)
            if sx then
                local info = string.format("%s | HP: %d | %s", ent.name, ent.health, ent.weapon_name)
                render.text(sx, sy, info, 255, 255, 255, 255)
                if ent.scoped then render.text(sx, sy + 15, "SCOPED", 255, 100, 100, 255) end
            end
        end
    end
end)`}
              </code>
            </pre>
          </div>

          <div>
            <div className="code-header">
              <span className="text-sm font-medium text-gray-400">hit_logger.lua</span>
              <button 
                onClick={() => copyToClipboard(`events.register("on_hit", function()
    client.log("You hit someone!")
end)
events.register("player_hurt", function(data)
    client.log(string.format("%s took %d damage (%d HP left)", data.name, data.damage, data.health))
end)`, "code-block-2", true)}
                className={cn("copy-btn", copyTooltip?.id === "code-block-2" && "bg-emerald-500 hover:bg-emerald-600")}
              >
                {copyTooltip?.id === "code-block-2" ? copyTooltip.text : "Copy Script"}
              </button>
            </div>
            <pre tabIndex={0}>
              <code className="language-lua p-4 block text-sm text-gray-300 leading-relaxed">
{`events.register("on_hit", function()
    client.log("You hit someone!")
end)
events.register("player_hurt", function(data)
    client.log(string.format("%s took %d damage (%d HP left)", data.name, data.damage, data.health))
end)`}
              </code>
            </pre>
          </div>
        </motion.section>

        <footer className="mt-12 border-t border-white/5 pt-12 text-center pb-12">
          <p className="text-gray-500 text-sm">© 2024 Scootware Cheat Systems. All rights reserved.</p>
        </footer>
      </main>
    </div>
  );
}
