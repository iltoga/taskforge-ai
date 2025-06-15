'use client';

export default function TestDaisyUI() {
  return (
    <div className="min-h-screen bg-base-100 p-8">
      <div className="container mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-center">DaisyUI Test Page</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Basic Components */}
          <div className="card bg-base-200 shadow-xl">
            <div className="card-body">
              <h2 className="card-title">Buttons</h2>
              <div className="space-y-2">
                <button className="btn btn-primary w-full">Primary</button>
                <button className="btn btn-secondary w-full">Secondary</button>
                <button className="btn btn-accent w-full">Accent</button>
              </div>
            </div>
          </div>

          {/* Theme Colors */}
          <div className="card bg-base-200 shadow-xl">
            <div className="card-body">
              <h2 className="card-title">Theme Colors</h2>
              <div className="grid grid-cols-2 gap-2">
                <div className="badge badge-primary">Primary</div>
                <div className="badge badge-secondary">Secondary</div>
                <div className="badge badge-accent">Accent</div>
                <div className="badge badge-neutral">Neutral</div>
              </div>
            </div>
          </div>

          {/* Forms */}
          <div className="card bg-base-200 shadow-xl">
            <div className="card-body">
              <h2 className="card-title">Forms</h2>
              <div className="space-y-2">
                <input type="text" placeholder="Type here" className="input input-bordered w-full" />
                <select className="select select-bordered w-full">
                  <option disabled selected>Pick one</option>
                  <option>Option 1</option>
                  <option>Option 2</option>
                </select>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="stats shadow">
            <div className="stat">
              <div className="stat-title">Total Users</div>
              <div className="stat-value">89,400</div>
              <div className="stat-desc">21% more than last month</div>
            </div>
          </div>

          {/* Alert */}
          <div className="alert alert-info">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            <span>DaisyUI is working correctly!</span>
          </div>

          {/* Progress */}
          <div className="card bg-base-200 shadow-xl">
            <div className="card-body">
              <h2 className="card-title">Progress</h2>
              <progress className="progress progress-primary w-full" value="70" max="100"></progress>
              <progress className="progress progress-secondary w-full" value="40" max="100"></progress>
            </div>
          </div>
        </div>

        {/* Theme Switcher Test */}
        <div className="mt-8 text-center">
          <div className="dropdown dropdown-end">
            <div tabIndex={0} role="button" className="btn btn-primary">
              Test Theme Switcher
            </div>
            <ul tabIndex={0} className="dropdown-content menu bg-base-100 rounded-box z-[1] w-52 p-2 shadow">
              <li><a onClick={() => document.documentElement.setAttribute('data-theme', 'light')}>Light</a></li>
              <li><a onClick={() => document.documentElement.setAttribute('data-theme', 'dark')}>Dark</a></li>
              <li><a onClick={() => document.documentElement.setAttribute('data-theme', 'cupcake')}>Cupcake</a></li>
              <li><a onClick={() => document.documentElement.setAttribute('data-theme', 'cyberpunk')}>Cyberpunk</a></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
