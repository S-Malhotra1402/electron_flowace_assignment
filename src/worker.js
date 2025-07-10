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
    
    console.log('Task 1: Generating large prime numbers...');
    await this.generateLargePrimes(10000); 
    
    console.log('Task 2: Generating 500MB random data file...');
    await this.generateRandomDataFile();
    
    console.log('Task 3: Processing large JSON dataset...');
    await this.processLargeJsonDataset();
    
    console.log('Task 4: Performing complex mathematical calculations...');
    await this.performComplexCalculations();
    
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
      if (num % 10000 === 0) {
        await this.sleep(10);
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
    const totalSize = 500 * 1024 * 1024; // 500MB
    let written = 0;
    
    const writeStream = fs.createWriteStream(filePath);
    
    return new Promise((resolve, reject) => {
      const writeChunk = () => {
        if (written >= totalSize) {
          writeStream.end();
          console.log(`Generated ${totalSize / (1024 * 1024)}MB file at ${filePath}`);
          resolve();
          return;
        }
        
        const remainingSize = Math.min(chunkSize, totalSize - written);
        const randomData = crypto.randomBytes(remainingSize);
        const jsonData = JSON.stringify({
          timestamp: Date.now(),
          data: randomData.toString('base64'),
          chunk: written / chunkSize,
          hash: crypto.createHash('sha256').update(randomData).digest('hex')
        }) + '\n';
        
        writeStream.write(jsonData, (error) => {
          if (error) {
            reject(error);
            return;
          }
          
          written += Buffer.byteLength(jsonData);
          
          // Progress logging
          if (written % (50 * 1024 * 1024) === 0) {
            console.log(`Written ${written / (1024 * 1024)}MB of ${totalSize / (1024 * 1024)}MB`);
          }
          
          setImmediate(writeChunk);
        });
      };
      
      writeChunk();
    });
  }

  async processLargeJsonDataset() {

    const records = [];
    const recordCount = 500000;
    
    console.log(`Generating ${recordCount} records...`);
    
    // Generate records
    for (let i = 0; i < recordCount; i++) {
      records.push({
        id: i,
        name: `User ${i}`,
        email: `user${i}@example.com`,
        age: Math.floor(Math.random() * 80) + 18,
        score: Math.random() * 100,
        salary: Math.floor(Math.random() * 100000) + 30000,
        metadata: {
          created: new Date().toISOString(),
          tags: Array.from({ length: Math.floor(Math.random() * 10) + 1 }, () => 
            Math.random().toString(36).substring(7)
          ),
          preferences: {
            theme: Math.random() > 0.5 ? 'dark' : 'light',
            notifications: Math.random() > 0.3,
            language: ['en', 'es', 'fr', 'de', 'it'][Math.floor(Math.random() * 5)]
          }
        }
      });
      
      // Yield control every 10000 records
      if (i % 10000 === 0 && i > 0) {
        console.log(`Generated ${i} records...`);
        await this.sleep(10);
      }
    }
    
    // Process records (sorting, filtering, aggregating)
    console.log('Processing records...');
    
    // Multiple sorting operations
    console.log('Sorting by score...');
    records.sort((a, b) => b.score - a.score);
    
    console.log('Sorting by age...');
    records.sort((a, b) => a.age - b.age);
    
    console.log('Sorting by salary...');
    records.sort((a, b) => b.salary - a.salary);
    
    // Filter operations
    const highScorers = records.filter(r => r.score > 90);
    const highEarners = records.filter(r => r.salary > 80000);
    const youngUsers = records.filter(r => r.age < 30);
    
    // Aggregate by age groups
    const ageGroups = {};
    records.forEach(record => {
      const ageGroup = Math.floor(record.age / 10) * 10;
      if (!ageGroups[ageGroup]) {
        ageGroups[ageGroup] = [];
      }
      ageGroups[ageGroup].push(record);
    });
    
    // Complex aggregations
    const languageStats = {};
    records.forEach(record => {
      const lang = record.metadata.preferences.language;
      if (!languageStats[lang]) {
        languageStats[lang] = { count: 0, totalSalary: 0 };
      }
      languageStats[lang].count++;
      languageStats[lang].totalSalary += record.salary;
    });
    
    console.log(`Processed ${records.length} records`);
    console.log(`Found ${highScorers.length} high scorers`);
    console.log(`Found ${highEarners.length} high earners`);
    console.log(`Found ${youngUsers.length} young users`);
    console.log(`Age groups: ${Object.keys(ageGroups).length}`);
    console.log(`Language distribution: ${Object.keys(languageStats).length} languages`);
    
    return {
      totalRecords: records.length,
      highScorers: highScorers.length,
      highEarners: highEarners.length,
      youngUsers: youngUsers.length,
      ageGroups: Object.keys(ageGroups).length,
      languages: Object.keys(languageStats).length
    };
  }

  async performComplexCalculations() {
    console.log('Performing matrix operations...');
    
    // Matrix multiplication
    const size = 500;
    const matrix1 = this.generateMatrix(size, size);
    const matrix2 = this.generateMatrix(size, size);
    
    const result = this.multiplyMatrices(matrix1, matrix2);
    console.log(`Completed ${size}x${size} matrix multiplication`);
    
    // Fibonacci calculations
    console.log('Calculating Fibonacci numbers...');
    const fibCount = 45;
    for (let i = 1; i <= fibCount; i++) {
      const fib = this.fibonacci(i);
      if (i % 5 === 0) {
        console.log(`Fibonacci(${i}) = ${fib}`);
      }
    }
    
    // Hash calculations
    console.log('Performing hash calculations...');
    for (let i = 0; i < 100000; i++) {
      const data = `complex_calculation_${i}_${Date.now()}`;
      const hash = crypto.createHash('sha256').update(data).digest('hex');
      
      if (i % 10000 === 0) {
        console.log(`Hash calculation ${i}/100000 completed`);
      }
    }
    
    console.log('Complex calculations completed');
  }

  generateMatrix(rows, cols) {
    const matrix = [];
    for (let i = 0; i < rows; i++) {
      matrix[i] = [];
      for (let j = 0; j < cols; j++) {
        matrix[i][j] = Math.random() * 100;
      }
    }
    return matrix;
  }

  multiplyMatrices(a, b) {
    const result = [];
    for (let i = 0; i < a.length; i++) {
      result[i] = [];
      for (let j = 0; j < b[0].length; j++) {
        let sum = 0;
        for (let k = 0; k < a[0].length; k++) {
          sum += a[i][k] * b[k][j];
        }
        result[i][j] = sum;
      }
    }
    return result;
  }

  fibonacci(n) {
    if (n <= 1) return n;
    return this.fibonacci(n - 1) + this.fibonacci(n - 2);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Start the worker
new HeavyTaskWorker(); 