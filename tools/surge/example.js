import { 
  createProjectManager, 
  generateDomain,
  SurgeClient 
} from './index.js';

async function exampleUsage() {
  const projectManager = createProjectManager('./my-surge-projects.json');

  console.log('=== Surge Service Examples ===\n');

  try {
    console.log('1. Creating a project with a persistent URL:');
    const persistentProject = await projectManager.createProject('my-dashboard', {
      persistentUrl: true,
      metadata: { description: 'Company dashboard' }
    });
    console.log('Created:', persistentProject);

    console.log('\n2. Creating a project with random domain:');
    const randomProject = await projectManager.createProject('test-deployment', {
      persistentUrl: false
    });
    console.log('Created:', randomProject);

    console.log('\n3. Deploying HTML content:');
    const htmlContent = `
      <h1>Hello from Surge!</h1>
      <p>This page was deployed using the Surge service.</p>
      <p>Generated domain: ${generateDomain()}</p>
    `;
    
    console.log('\n4. Available domain examples:');
    for (let i = 0; i < 5; i++) {
      console.log(`   - ${generateDomain()}.surge.sh`);
    }

    console.log('\n5. List all projects:');
    const allProjects = projectManager.getAllProjects();
    console.log(allProjects);

  } catch (error) {
    console.error('Error:', error.message);
  }
}

async function deploymentExample() {
  const projectManager = createProjectManager();
  
  try {
    console.log('\n=== Deployment Example ===\n');
    
    await projectManager.deployHtmlContent('data-report', `
      <h1>Weekly Data Report</h1>
      <p>Generated on: ${new Date().toLocaleString()}</p>
      <table border="1">
        <tr><th>Metric</th><th>Value</th></tr>
        <tr><td>Total Users</td><td>1,234</td></tr>
        <tr><td>Active Sessions</td><td>456</td></tr>
      </table>
    `, {
      persistentUrl: true,
      metadata: { type: 'report', frequency: 'weekly' }
    });

    console.log('Report deployed successfully!');
    
  } catch (error) {
    console.error('Deployment failed:', error.message);
  }
}

async function listRemoteProjects() {
  const client = new SurgeClient();
  
  try {
    console.log('\n=== Remote Surge Projects ===\n');
    const projects = client.list();
    projects.forEach(project => {
      console.log(`- ${project.domain} (${project.timeAgo})`);
      console.log(`  URL: ${project.url}`);
    });
  } catch (error) {
    console.error('Failed to list projects:', error.message);
  }
}

if (require.main === module) {
  console.log('Running Surge Service Examples...\n');
  exampleUsage();
}