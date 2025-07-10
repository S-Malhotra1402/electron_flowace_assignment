// CPU-intensive worker process
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class HeavyTaskWorker {
  constructor() {
    this.startTime = Date.now();
    this.runTask();
  }

  async runTask() {
    console.log('Starting heavy task...');
    
    // Task 1: Generate large prime numbers (CPU intensive)
    console.log('Task 1: Generating large prime numbers...');
    await this.generateLargePrimes(1000);
    
    // Task 2: Generate random data file (I/O intensive)
    console.log('Task 2: Generating 100MB random data file...');
    await this.generateRandomDataFile();
    
    // Task 3: Process large JSON dataset (Memory intensive)
    console.log('Task 3: Processing large JSON dataset...');
    await this.processLargeJsonDataset();
    
    const endTime = Date.now();
    const duration = (endTime - this.startTime) / 1000;
    console.log(`Heavy task completed in ${duration.toFixed(2)} seconds`);
    
    process.exit(0);
  }

  async generateLargePrimes(count) {
    let primes = [];
    let num = 2;
    
    while (primes.length < count) {
      if (this.isPrime(num)) {
        primes.push(num);
      }
      num++;
      
      // Yield control occasionally to prevent complete blocking
      if (num % 1000 === 0) {
        await this.sleep(1);
      }
    }
    
    console.log(`Generated ${primes.length} prime numbers. Largest: ${primes[primes.length - 1]}`);
    return primes;
  }

  isPrime(n) {
    if (n < 2) return false;
    if (n === 2) return true;
    if (n % 2 === 0) return false;
    
    for (let i = 3; i <= Math.sqrt(n); i += 2) {
      if (n % i === 0) return false;
    }
    return true;
  }

  async generateRandomDataFile() {
    const filePath = path.join(require('os').tmpdir(), 'heavy_task_data.json');
    const chunkSize = 1024 * 1024; // 1MB chunks
    const totalSize = 100 * 1024 * 1024; // 100MB
    let written = 0;
    
    const writeStream = fs.createWriteStream(filePath);
    
    return new Promise((resolve, reject) => {
      const writeChunk = () => {
        if (written >= totalSize) {
          writeStream.end();
          resolve();
          return;
        }
        
        const remainingSize = Math.min(chunkSize, totalSize - written);
        const randomData = crypto.randomBytes(remainingSize);
        const jsonData = JSON.stringify({
          timestamp: Date.now(),
          data: randomData.toString('base64'),
          chunk: written / chunkSize
        }) + '\n';
        
        writeStream.write(jsonData, (error) => {
          if (error) {
            reject(error);
            return;
          }
          
          written += Buffer.byteLength(jsonData);
          setImmediate(writeChunk);
        });
      };
      
      writeChunk();
    });
  }

  async processLargeJsonDataset() {
    // Create and process 100,000 JSON records
    const records = [];
    const recordCount = 100000;
    
    // Generate records
    for (let i = 0; i < recordCount; i++) {
      records.push({
        id: i,
        name: `User ${i}`,
        email: `user${i}@example.com`,
        age: Math.floor(Math.random() * 80) + 18,
        score: Math.random() * 100,
        metadata: {
          created: new Date().toISOString(),
          tags: Array.from({ length: Math.floor(Math.random() * 5) + 1 }, () => 
            Math.random().toString(36).substring(7)
          )
        }
      });
      
      // Yield control every 1000 records
      if (i % 1000 === 0) {
        await this.sleep(1);
      }
    }
    
    // Process records (sorting, filtering, aggregating)
    console.log('Processing records...');
    
    // Sort by score
    records.sort((a, b) => b.score - a.score);
    
    // Filter high scorers
    const highScorers = records.filter(r => r.score > 90);
    
    // Aggregate by age groups
    const ageGroups = {};
    records.forEach(record => {
      const ageGroup = Math.floor(record.age / 10) * 10;
      if (!ageGroups[ageGroup]) {
        ageGroups[ageGroup] = [];
      }
      ageGroups[ageGroup].push(record);
    });
    
    console.log(`Processed ${records.length} records`);
    console.log(`Found ${highScorers.length} high scorers`);
    console.log(`Age groups: ${Object.keys(ageGroups).length}`);
    
    return {
      totalRecords: records.length,
      highScorers: highScorers.length,
      ageGroups: Object.keys(ageGroups).length
    };
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Start the worker
new HeavyTaskWorker(); 